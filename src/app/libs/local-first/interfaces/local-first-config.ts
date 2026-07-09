import { InjectionToken } from '@angular/core';

export interface LocalFirstConfig {
  dbName: string;
  dbVersion: number;
  stores: { [tableName: string]: string }; // Dexie store configurations (e.g. 'id, name')
  mode: 'dual' | 'local-only';
}

export const LOCAL_FIRST_CONFIG = new InjectionToken<LocalFirstConfig>('LOCAL_FIRST_CONFIG');
