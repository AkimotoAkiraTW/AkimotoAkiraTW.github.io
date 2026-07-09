import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode } from '@angular/core';
import { routes } from './app.routes';
import { provideLocalFirst } from './libs/local-first';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    provideLocalFirst({
      dbName: 'LocalToolkitDB',
      // v3: SupplierProfile 改為通用欄位（mainProducts / sourceLocation / leadTimeNotes /
      // deliveryTerms / paymentTerms），並新增 Partner.industry。未部署前由使用者清除瀏覽資料。
      dbVersion: 3,
      stores: {
        partners:
          'id, displayName, primaryPhone, primaryCity, partnerType, isCustomer, isSupplier, isActive, updatedAt, isDeleted',
        customerCategories: 'id, name, sortOrder, isDeleted',
        supplierCategories: 'id, name, sortOrder, isDeleted',
      },
      mode: 'local-only',
    }),
  ],
};

