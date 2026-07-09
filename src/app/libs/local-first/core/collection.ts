import { Table } from 'dexie';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { BaseEntity } from '../interfaces/base-entity';
import { QueryBuilder } from './query-builder';

// Safe secure UUID v4 generator supporting both secure (HTTPS/localhost) and insecure contexts
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Cryptographically secure fallback if randomUUID is unavailable
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(array);
  } else {
    // Pure pseudorandom fallback as absolute last resort
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  array[6] = (array[6] & 0x0f) | 0x40; // Version 4
  array[8] = (array[8] & 0x3f) | 0x80; // Variant 10xx
  
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

export class Collection<T extends BaseEntity> {
  constructor(private table: Table<T, any>, private storeName: string) {}

  public query(): QueryBuilder<T> {
    return new QueryBuilder<T>(this.table, this.storeName);
  }

  async get(id: string): Promise<T | undefined> {
    const record = await this.table.get(id);
    return record && !record.isDeleted ? record : undefined;
  }

  async add(item: Omit<T, 'id' | 'updatedAt' | 'isDeleted'>): Promise<T> {
    const record = {
      ...item,
      id: generateUUID(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    } as unknown as T;
    
    await this.table.add(record);
    return record;
  }

  async update(id: string, updates: Partial<Omit<T, 'id'>>): Promise<void> {
    const recordUpdates = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.table.update(id, recordUpdates as any);
  }

  async delete(id: string, soft: boolean = true): Promise<void> {
    if (soft) {
      await this.table.update(id, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      } as any);
    } else {
      await this.table.delete(id);
    }
  }

  async bulkAdd(items: Array<Omit<T, 'id' | 'updatedAt' | 'isDeleted'>>): Promise<T[]> {
    const records = items.map(item => ({
      ...item,
      id: generateUUID(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    } as unknown as T));
    await this.table.bulkAdd(records);
    return records;
  }

  // Raw change observation trigger
  public watch(): Observable<T[]> {
    return from(liveQuery(() => this.table.filter(item => !item.isDeleted).toArray()));
  }
}
