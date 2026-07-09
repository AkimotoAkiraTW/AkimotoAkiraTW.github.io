import { Injectable, inject } from '@angular/core';
import { LocalDatabase } from '../../../libs/local-first';
import { CustomerCategory, SupplierCategory } from './category.model';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * 預設分類：以「通用小型 B2B / 個人 CRM」場景出發，
 * 同時保留農漁案例下的典型分類（農漁會會員）作為示範。
 * 使用者可在 UI 中新增/刪除以對應自身產業。
 */
const DEFAULT_CUSTOMER_CATEGORIES = [
  '一般客戶',
  '零售客戶',
  '批發客戶',
  '企業客戶',
  'VIP / 重點客戶',
  '農漁會會員',
];

const DEFAULT_SUPPLIER_CATEGORIES = [
  '原料供應商',
  '商品供應商',
  '服務供應商',
  '設備供應商',
  '物流／配送',
  '其他',
];

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private db = inject(LocalDatabase);
  private customerCollection = this.db.collection<CustomerCategory>('customerCategories');
  private supplierCollection = this.db.collection<SupplierCategory>('supplierCategories');
  private seeded = false;

  readonly customerCategories = toSignal(
    this.customerCollection.query().orderBy('sortOrder').asObservable(),
    { initialValue: [] as CustomerCategory[] }
  );

  readonly supplierCategories = toSignal(
    this.supplierCollection.query().orderBy('sortOrder').asObservable(),
    { initialValue: [] as SupplierCategory[] }
  );

  async ensureDefaultCategories(): Promise<void> {
    if (this.seeded) return;
    this.seeded = true;

    const existingCustomers = await this.customerCollection.query().toPromise();
    if (existingCustomers.length === 0) {
      await this.customerCollection.bulkAdd(
        DEFAULT_CUSTOMER_CATEGORIES.map((name, index) => ({
          name,
          sortOrder: index,
        }))
      );
    }

    const existingSuppliers = await this.supplierCollection.query().toPromise();
    if (existingSuppliers.length === 0) {
      await this.supplierCollection.bulkAdd(
        DEFAULT_SUPPLIER_CATEGORIES.map((name, index) => ({
          name,
          sortOrder: index,
        }))
      );
    }
  }
}
