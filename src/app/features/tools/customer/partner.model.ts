import { BaseEntity } from '../../../libs/local-first';

/**
 * ─── Partner Aggregate（IndexedDB store: `partners`, dbVersion: 3） ───
 *
 * 設計重點（v3 通用化）：
 *  - 早期版本將 SupplierProfile 設計成偏向「農、漁產供應商」（產區、產季、漁港…），
 *    導致服務型供應商（會計、律師、軟體外包）、一般商品批發商、物流商、
 *    分包商等情境無法乾淨表達。v3 將其改為產業無關（industry-agnostic）的命名。
 *  - 命名通則：用「主要產品/服務」「來源地/所在地」「交期」「交貨條件」「付款條件」，
 *    讓 B2C / B2B / 個人接案 / 大型企業合作都能套用；農漁案例仍能用同樣的欄位表達。
 *  - `Partner.industry` 是跨切面（cross-cutting）自由文字欄位（如「電子零件」「會計師事務所」
 *    「水產養殖」），與 customer/supplier 角色獨立，方便日後做產業統計或進階篩選。
 *  - 角色（isCustomer/isSupplier）保留 bitfield 風格；對應的 customer/supplier profile
 *    在儲存時若角色為 false 會 strip 成 undefined（見 partner-normalize.ts）。
 *  - 表單編輯時透過 `PartnerFormValue` 強制提供完整巢狀物件，方便 Signal Forms 綁定，
 *    儲存時再 normalize。
 */

export type PartnerType = 'individual' | 'enterprise';

export interface IndividualProfile {
  lastName: string;
  firstName: string;
  phone: string;
  email: string;
  identificationNumber: string;
  birthDate: string;
}

export interface EnterpriseProfile {
  companyName: string;
  businessID: string;
  taxID: string;
  responsiblePerson: string;
  phone: string;
  email: string;
}

export interface CustomerProfile {
  customerCode?: string;
  categoryId?: string;
  /** 結帳日 1–31，月結客戶常用 */
  settlementDay?: number | null;
  /** 付款條件備註（如「月結 30 天」「貨到付款」），自由文字以保留彈性 */
  paymentTerms?: string;
}

export interface SupplierProfile {
  supplierCode?: string;
  categoryId?: string;
  /**
   * 主要產品 / 服務項目。
   * 例：原料供應商填「螺絲、鋼板」；會計事務所填「記帳、稅務申報」；農場填「高麗菜、青江菜」。
   */
  mainProducts?: string[];
  /**
   * 來源地 / 所在地。
   * 例：工廠地、辦公室、產地、漁港、發貨倉等，自由文字。
   */
  sourceLocation?: string;
  /**
   * 交期 / 供貨備註：常見填寫如「下單後 3–5 天到貨」「產季 10–3 月」「24 小時內回覆」。
   */
  leadTimeNotes?: string;
  /**
   * 交貨條件：自取、宅配、貨運、線上交付（電子檔）等。
   */
  deliveryTerms?: string;
  /**
   * 付款條件：如「月結 60 天」「預付」「現金交易」「貨到付款」。
   */
  paymentTerms?: string;
}

export interface PartnerAddress {
  id: string;
  label?: string;
  city: string;
  district?: string;
  postalCode?: string;
  address: string;
  country?: string;
  isPrimary: boolean;
}

export interface AdditionalContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  notes: string;
  isPrimary: boolean;
}

export interface Partner extends BaseEntity {
  partnerType: PartnerType;
  isActive: boolean;
  isCustomer: boolean;
  isSupplier: boolean;

  individual?: IndividualProfile;
  enterprise?: EnterpriseProfile;
  customer?: CustomerProfile;
  supplier?: SupplierProfile;

  addresses: PartnerAddress[];
  additionalContacts: AdditionalContact[];

  /**
   * 產業 / 行業別（自由文字，例：「電子製造」「餐飲」「會計事務所」「水產」）。
   * 跨切面欄位，獨立於 customer/supplier 角色，便於分群統計與全文搜尋。
   */
  industry?: string;

  notes?: string;
  tags?: string[];

  displayName: string;
  primaryPhone: string;
  primaryEmail?: string;
  primaryCity: string;
}

/** 表單編輯用：巢狀區塊始終存在；儲存時由 normalizePartnerForSave 依角色 strip。 */
export type PartnerFormValue = Partner & {
  individual: IndividualProfile;
  enterprise: EnterpriseProfile;
  customer: CustomerProfile;
  supplier: SupplierProfile;
};

export const CITIES = [
  '台北市',
  '新北市',
  '桃園市',
  '台中市',
  '台南市',
  '高雄市',
  '新竹市',
  '基隆市',
  '宜蘭縣',
  '花蓮縣',
];
