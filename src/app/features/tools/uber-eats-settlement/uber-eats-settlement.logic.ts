export type CustomizationKind = 'sugar' | 'ice' | 'size' | 'topping';

export interface CustomizationOption {
  label: string;
  price: number;
  kind: CustomizationKind;
}

const TRAILING_ENGLISH =
  /\s+(?:\d+(?:\.\d+)?%\s+)?[A-Za-z][A-Za-z0-9%+\-]*(?:\s+[A-Za-z][A-Za-z0-9%+\-]*)*$/;

export function classifyCustomization(label: string): CustomizationKind {
  if (/糖|sweet|sugar/i.test(label)) return 'sugar';
  if (/杯|size|tall|grande|venti|medium|large|small/i.test(label)) return 'size';
  if (/去冰|微冰|少冰|正常冰|多冰|冰量|熱飲|溫飲|\bice\b|ice level/i.test(label)) return 'ice';
  if (/冰/.test(label) && !/限冰/.test(label)) return 'ice';
  return 'topping';
}

function preferChineseLabel(text: string): string {
  const trimmed = text.trim();
  if (!/[\u4e00-\u9fff]/.test(trimmed)) return trimmed;
  const stripped = trimmed.replace(TRAILING_ENGLISH, '').trim();
  return stripped || trimmed;
}

/** 把 subtitle 拆成加項（少糖、無糖、微冰、珍珠…），標籤優先中文 */
export function parseCustomizationOptions(subtitle: string): CustomizationOption[] {
  if (!subtitle.trim()) return [];
  return subtitle
    .split(/\s*(?:•|·|∙|｜)\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const priceMatch = raw.match(/\(\$(\d+\.?\d*)\)\s*$/);
      const price = priceMatch ? parseFloat(priceMatch[1]) || 0 : 0;
      const withoutPrice = raw.replace(/\s*\(\$[\d.]+\)\s*$/, '').trim();
      const label = preferChineseLabel(withoutPrice);
      return { label, price, kind: classifyCustomization(label) };
    })
    .filter((option) => option.label.length > 0);
}

/** 從 Uber Eats 品項 subtitle 加總 ($x.xx) 加料金額 */
export function sumCustomizationFromSubtitle(subtitle: string): number {
  return parseCustomizationOptions(subtitle).reduce((total, option) => total + option.price, 0);
}

export function nearlyEqual(a: number, b: number, epsilon = 0.051): boolean {
  return Math.abs(a - b) <= epsilon;
}

export interface ItemDiscountResult {
  finalPayablePrice: number;
  explicitDiscount: number;
}

/**
 * `itemDiscount.formattedAmount` 是收據上劃線後的應付（FINAL）。
 * `$0.00` 視為沒有折扣，不是免費。
 */
export function resolveItemDiscount(
  originalPrice: number,
  discountVal: number,
): ItemDiscountResult {
  if (discountVal <= 0 || originalPrice <= 0) {
    return { finalPayablePrice: originalPrice, explicitDiscount: 0 };
  }

  const finalPayablePrice = Math.min(discountVal, originalPrice);
  return {
    finalPayablePrice,
    explicitDiscount: Math.max(0, originalPrice - finalPayablePrice),
  };
}

/** getActiveOrdersV1 沒有外送/服務/會員明細；用實付 − 餐點小計還原淨額 */
export function allocateUnspecifiedNet(
  orderTotal: number,
  foodSubtotal: number,
): { deliveryFee: number; globalDiscount: number } {
  const gap = Math.round((orderTotal - foodSubtotal) * 100) / 100;
  if (gap >= 0) {
    return { deliveryFee: gap, globalDiscount: 0 };
  }
  return { deliveryFee: 0, globalDiscount: Math.round(-gap * 100) / 100 };
}

export interface ParsedLineItem {
  storeName: string;
  buyer: string;
  itemName: string;
  quantity: number;
  price: number;
  customizationPrice: number;
  customizations: CustomizationOption[];
  explicitDiscount: number;
  finalPayable: number;
  originalPayable: number;
  unitBasePrice: number;
}

export interface ProductSetting {
  isBogo: boolean;
  isGift: boolean;
  bogoLimit: number | null;
  /** auto：只標示，不改 JSON 已算好的折後價；manual：使用者覆寫後才重算 */
  source: 'auto' | 'manual';
  /** 實付 / 原價，例如 0.8 = 8 折 */
  percentOff: number | null;
}

export function emptyProductSetting(): ProductSetting {
  return {
    isBogo: false,
    isGift: false,
    bogoLimit: null,
    source: 'auto',
    percentOff: null,
  };
}

export function formatPercentOffLabel(payRatio: number): string {
  const tenths = Math.round(payRatio * 10);
  if (Math.abs(payRatio - tenths / 10) <= 0.02) {
    return `${tenths}折`;
  }
  return `${Math.round(payRatio * 100)}折`;
}

const COMMON_PAY_RATIOS = [0.9, 0.85, 0.8, 0.75, 0.7];

export function matchPayRatio(payable: number, listPrice: number): number | null {
  if (listPrice <= 0 || payable <= 0) return null;
  const ratio = payable / listPrice;
  for (const expected of COMMON_PAY_RATIOS) {
    if (Math.abs(ratio - expected) <= 0.02) return expected;
  }
  return null;
}

/** 中杯買一送一：付 ceil(qty/2) 杯底價 + 全部加大／加料 */
export function expectedBogoPayable(unitBase: number, quantity: number, custom: number): number {
  const paidCups = quantity - Math.floor(quantity / 2);
  return paidCups * unitBase + custom;
}

interface TitleGroupStats {
  totalQty: number;
  maxQty: number;
  hasBogoLine: boolean;
  hasFreeCup: boolean;
  hasPaidCup: boolean;
  hasGiftKeyword: boolean;
  percentOff: number | null;
}

/** 依品項名稱標示買一送一 / 贈品 / 打折（預設不改價，JSON 折後價已是收據數字） */
export function detectProductSettings(
  items: Array<{
    itemName: string;
    quantity: number;
    price: number;
    customizationPrice: number;
    explicitDiscount: number;
    originalPayable: number;
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
        maxQty: 0,
        hasBogoLine: false,
        hasFreeCup: false,
        hasPaidCup: false,
        hasGiftKeyword: isGiftKeyword,
        percentOff: null,
      };
    }

    const group = titleGroups[title];
    group.hasGiftKeyword = group.hasGiftKeyword || isGiftKeyword;
    group.totalQty += item.quantity;
    if (item.quantity > group.maxQty) {
      group.maxQty = item.quantity;
    }

    const payable = item.originalPayable;
    const custom = item.customizationPrice;
    const qty = item.quantity || 1;
    const unitBase = qty > 0 ? (item.price - custom) / qty : 0;

    if (item.price <= 0) continue;

    if (qty >= 2 && nearlyEqual(payable, expectedBogoPayable(unitBase, qty, custom))) {
      group.hasBogoLine = true;
    }

    const addonOnly = item.explicitDiscount > 0 && nearlyEqual(payable, custom);
    if (addonOnly) {
      group.hasFreeCup = true;
    } else if (payable > custom + 0.5) {
      group.hasPaidCup = true;
    }

    const ratio = matchPayRatio(payable, item.price);
    if (ratio != null) {
      group.percentOff = ratio;
    }
  }

  const settings: Record<string, ProductSetting> = { ...existing };

  for (const title of Object.keys(titleGroups)) {
    if (settings[title]?.source === 'manual') continue;

    const g = titleGroups[title];
    let isGift = false;
    let isBogo = false;
    let percentOff: number | null = null;

    if (g.hasGiftKeyword || (g.maxQty === 1 && g.hasFreeCup && !g.hasPaidCup)) {
      isGift = true;
    }

    if (!isGift && (g.hasBogoLine || (g.hasFreeCup && (g.hasPaidCup || g.totalQty >= 2)))) {
      isBogo = true;
    }

    if (!isGift && !isBogo && g.percentOff != null) {
      percentOff = g.percentOff;
    }

    settings[title] = {
      isBogo,
      isGift,
      bogoLimit: null,
      source: 'auto',
      percentOff,
    };
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
  const customizations = parseCustomizationOptions(subtitle);
  const unitCustomization = customizations.reduce((total, option) => total + option.price, 0);

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
    const resolved = resolveItemDiscount(originalPrice, discountVal);
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
    customizations,
    explicitDiscount,
    finalPayable: finalPayablePrice,
    originalPayable: finalPayablePrice,
    unitBasePrice,
  };
}
