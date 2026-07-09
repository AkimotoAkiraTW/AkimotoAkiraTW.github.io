import { Table, liveQuery } from 'dexie';
import { Observable, map, from } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { Signal, isDevMode } from '@angular/core';
import { BaseEntity } from '../interfaces/base-entity';
import { WhereClause, WhereOperation } from './where-clause';

export class QueryBuilder<T extends BaseEntity> {
  private whereOps: WhereOperation<T>[] = [];
  private memoryFilters: ((item: T) => boolean)[] = [];
  private sortField?: string;
  private isDesc: boolean = false;
  private skipCount: number = 0;
  private limitCount?: number;

  constructor(private table: Table<T, any>, private storeName: string) {
    // Automatically filter out soft-deleted records by default
    this.memoryFilters.push(item => !item.isDeleted);
  }

  addWhereOperation(op: WhereOperation<T>): QueryBuilder<T> {
    this.whereOps.push(op);
    return this;
  }

  where<K extends keyof T & string>(field: K): WhereClause<T, T[K]> {
    return new WhereClause<T, T[K]>(this, field);
  }

  filter(predicate: (item: T) => boolean): QueryBuilder<T> {
    this.memoryFilters.push(predicate);
    return this;
  }

  orderBy<K extends keyof T & string>(field: K): QueryBuilder<T> {
    this.sortField = field;
    this.isDesc = false;
    return this;
  }

  orderByDesc<K extends keyof T & string>(field: K): QueryBuilder<T> {
    this.sortField = field;
    this.isDesc = true;
    return this;
  }

  skip(count: number): QueryBuilder<T> {
    this.skipCount = count;
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.limitCount = count;
    return this;
  }

  apply(fn: (q: QueryBuilder<T>) => QueryBuilder<T>): QueryBuilder<T> {
    return fn(this);
  }

  // --- Execution Plan & Resolution Engine ---
  private async executeQuery(): Promise<T[]> {
    let collection: any = this.table;
    let indexUsed: string | null = null;
    let dexieWhereApplied = false;

    // Check if table contains declared indexes
    const tableIndexes = this.table.schema.indexes.map(idx => idx.name);
    
    // Tier 1: Try applying native Dexie index scan for the first matching where clause (excluding booleans as IndexedDB keys cannot be boolean type)
    const indexableOp = this.whereOps.find(op => (tableIndexes.includes(op.field) || op.field === 'id') && typeof op.value !== 'boolean');
    
    if (indexableOp) {
      const field = indexableOp.field;
      indexUsed = field;
      dexieWhereApplied = true;
      const val = indexableOp.value;

      switch (indexableOp.operator) {
        case 'equals':
          collection = this.table.where(field).equals(val);
          break;
        case 'gt':
          collection = this.table.where(field).above(val);
          break;
        case 'gte':
          collection = this.table.where(field).aboveOrEqual(val);
          break;
        case 'lt':
          collection = this.table.where(field).below(val);
          break;
        case 'lte':
          collection = this.table.where(field).belowOrEqual(val);
          break;
        case 'between':
          collection = this.table.where(field).between(val, indexableOp.upperValue, true, true);
          break;
        case 'startsWith':
          collection = this.table.where(field).startsWith(val);
          break;
        case 'anyOf':
          collection = this.table.where(field).anyOf(val);
          break;
        default:
          // For other operators, native Dexie queries are tricky; resolve via memory scan
          dexieWhereApplied = false;
          indexUsed = null;
          break;
      }
    }

    // Load initial datasets from Dexie index scan or complete table scan
    let list: T[] = [];
    if (dexieWhereApplied) {
      list = await collection.toArray();
    } else {
      list = await this.table.toArray();
    }

    // Tier 2: In-Memory Filters (soft delete filter + custom filters + unhandled where clauses)
    const activeFilters = [...this.memoryFilters];
    
    // Add where operators not natively resolved
    this.whereOps.forEach(op => {
      if (dexieWhereApplied && op.field === indexUsed) return; // Already solved by Tier 1
      
      activeFilters.push(item => {
        const val = (item as any)[op.field];
        const compareVal = op.value;
        switch (op.operator) {
          case 'equals': return val === compareVal;
          case 'notEquals': return val !== compareVal;
          case 'gt': return val > compareVal;
          case 'gte': return val >= compareVal;
          case 'lt': return val < compareVal;
          case 'lte': return val <= compareVal;
          case 'between': return val >= compareVal && val <= op.upperValue;
          case 'startsWith': return typeof val === 'string' && val.startsWith(compareVal);
          case 'contains': return typeof val === 'string' && val.includes(compareVal);
          case 'anyOf': return Array.isArray(compareVal) && compareVal.includes(val);
          case 'isNull': return val === null || val === undefined;
          case 'isNotNull': return val !== null && val !== undefined;
          default: return true;
        }
      });
    });

    if (activeFilters.length > 0) {
      list = list.filter(item => activeFilters.every(fn => fn(item)));
    }

    // In-Memory Sorting
    if (this.sortField) {
      list.sort((a: any, b: any) => {
        const valA = a[this.sortField!];
        const valB = b[this.sortField!];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        const result = valA < valB ? -1 : 1;
        return this.isDesc ? -result : result;
      });
    }

    // Log Query Plan in Developer Mode to verify index hit vs table scans
    if (isDevMode()) {
      console.debug(`[QueryPlan] Store: "${this.storeName}" | Index Hit: ${indexUsed ? `"${indexUsed}"` : 'None (Full Scan)'} | Total Scanned: ${list.length} records.`);
    }

    // Tier 3: Pagination
    if (this.skipCount > 0) {
      list = list.slice(this.skipCount);
    }
    if (this.limitCount !== undefined) {
      list = list.slice(0, this.limitCount);
    }

    return list;
  }

  // --- Output Adapters ---
  asObservable(): Observable<T[]> {
    // Wrap execution inside Dexie's liveQuery to trigger reactivity whenever tables undergo changes
    return from(liveQuery(() => this.executeQuery()));
  }

  asSignal(options?: { initialValue: T[] }): Signal<T[]> {
    return toSignal(this.asObservable(), { initialValue: options?.initialValue ?? [] });
  }

  toPromise(): Promise<T[]> {
    return this.executeQuery();
  }

  count$(): Observable<number> {
    return this.asObservable().pipe(map(list => list.length));
  }

  first$(): Observable<T | undefined> {
    return this.asObservable().pipe(map(list => list[0]));
  }
}
