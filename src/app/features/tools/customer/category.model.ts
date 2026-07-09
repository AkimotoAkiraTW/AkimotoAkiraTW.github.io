import { BaseEntity } from '../../../libs/local-first';

/** 客戶分類主檔（IndexedDB: customerCategories） */
export interface CustomerCategory extends BaseEntity {
  name: string;
  sortOrder?: number;
  parentId?: string;
}

/** 供應商分類主檔（IndexedDB: supplierCategories） */
export interface SupplierCategory extends BaseEntity {
  name: string;
  sortOrder?: number;
  parentId?: string;
}
