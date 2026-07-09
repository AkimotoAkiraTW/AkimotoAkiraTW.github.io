import { Injectable, Inject, OnDestroy } from '@angular/core';
import Dexie from 'dexie';
import { LOCAL_FIRST_CONFIG, LocalFirstConfig } from '../interfaces/local-first-config';
import { Collection } from './collection';
import { BaseEntity } from '../interfaces/base-entity';

@Injectable({ providedIn: 'root' })
export class LocalDatabase implements OnDestroy {
  public dexieDb!: Dexie;

  constructor(@Inject(LOCAL_FIRST_CONFIG) private config: LocalFirstConfig) {
    this.initDatabase();
  }

  private initDatabase() {
    this.dexieDb = new Dexie(this.config.dbName);
    this.dexieDb.version(this.config.dbVersion).stores(this.config.stores);
  }

  public collection<T extends BaseEntity>(storeName: string): Collection<T> {
    const table = this.dexieDb.table<T>(storeName);
    return new Collection<T>(table, storeName);
  }

  ngOnDestroy() {
    this.dexieDb.close();
  }
}
