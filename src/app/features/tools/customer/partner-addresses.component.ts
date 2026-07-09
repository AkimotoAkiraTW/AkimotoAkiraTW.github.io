import { ChangeDetectorRef, Component, inject, input } from '@angular/core';
import { MatOptionModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CITIES } from './partner.model';
import { generateLocalId } from './partner-normalize';
import {
  UiFieldGroupComponent,
  UiSelectFieldComponent,
  UiTextFieldComponent,
} from '../../../shared/components/form-primitives';

@Component({
  selector: 'app-partner-addresses',
  standalone: true,
  imports: [
    MatOptionModule,
    MatButtonModule,
    MatIconModule,
    UiTextFieldComponent,
    UiSelectFieldComponent,
    UiFieldGroupComponent,
  ],
  template: `
    <div class="addresses-container">
      <div class="header-row">
        <span class="section-subtitle">
          地址清單（共 {{ modelSignal()().addresses.length }} 筆）
        </span>
        <button type="button" mat-stroked-button color="primary" class="compact-btn" (click)="addAddress()">
          <mat-icon>add_location</mat-icon> 新增地址
        </button>
      </div>

      <div class="cards-list">
        @for (address of modelSignal()().addresses; track address.id; let idx = $index) {
          @if (idx < form().addresses.length) {
            <div class="surface-card item-card" [class.is-primary]="form().addresses[idx].isPrimary().value()">
              <div class="card-header">
                <span class="card-index">地址 #{{ idx + 1 }}</span>
                <div class="card-actions">
                  @if (form().addresses[idx].isPrimary().value()) {
                    <span class="badge badge-warning primary-tag">
                      <mat-icon>star</mat-icon> 主要通訊地
                    </span>
                  } @else {
                    <button
                      type="button"
                      mat-icon-button
                      (click)="setPrimaryAddress(idx)"
                      title="設為主要"
                      class="icon-btn"
                    >
                      <mat-icon>star_border</mat-icon>
                    </button>
                  }
                  <button
                    type="button"
                    mat-icon-button
                    color="warn"
                    (click)="removeAddress(idx)"
                    title="刪除此地址"
                    class="icon-btn"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <ui-field-group class="address-grid" layout="grid">
                <ui-select-field
                  class="city-field"
                  label="縣市"
                  [field]="form().addresses[idx].city"
                >
                  @for (c of cities; track c) {
                    <mat-option [value]="c">{{ c }}</mat-option>
                  }
                </ui-select-field>
                <ui-text-field
                  label="鄉鎮區"
                  [field]="form().addresses[idx].district"
                  placeholder="例：大安區"
                />
                <ui-text-field
                  label="郵遞區號"
                  [field]="form().addresses[idx].postalCode"
                  placeholder="3 位或 5 位"
                />
                <ui-text-field
                  class="detail-field"
                  label="詳細地址"
                  [field]="form().addresses[idx].address"
                  placeholder="例：信義路三段 100 號 5 樓"
                  errorFallback="地址必填"
                />
              </ui-field-group>
            </div>
          }
        }

        @if (modelSignal()().addresses.length === 0) {
          <div class="empty-state">
            <mat-icon>location_off</mat-icon>
            <p>目前尚無登記地址，點選右上角「新增地址」加入通訊地。</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .addresses-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
      padding: var(--space-xs);
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }

    .cards-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    .item-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .item-card.is-primary {
      border-color: var(--accent-color);
      background: var(--accent-softer);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px dashed var(--border-color);
      padding-bottom: var(--space-sm);
    }

    .card-index {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    .primary-tag .mat-icon,
    .primary-tag mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .icon-btn {
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 !important;
    }
    .icon-btn .mat-icon,
    .icon-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .address-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: var(--space-md);
    }

    .address-grid .detail-field { grid-column: span 1; }
    @media (min-width: 600px) {
      .address-grid .detail-field { grid-column: span 3; }
    }

    .address-grid ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: block !important;
    }
  `],
})
export class PartnerAddressesComponent {
  form = input.required<any>();
  modelSignal = input.required<any>();

  private readonly cdr = inject(ChangeDetectorRef);

  cities = CITIES;

  addAddress() {
    this.modelSignal().update((m: any) => {
      const currentAddresses = m.addresses || [];
      const newAddress = {
        id: generateLocalId(),
        address: '',
        city: '台北市',
        district: '',
        postalCode: '',
        country: '台灣',
        isPrimary: currentAddresses.length === 0,
      };
      return {
        ...m,
        addresses: [...currentAddresses, newAddress],
      };
    });
    queueMicrotask(() => this.cdr.detectChanges());
  }

  removeAddress(index: number) {
    this.modelSignal().update((m: any) => {
      const currentAddresses = m.addresses || [];
      const filtered = currentAddresses.filter((_: any, i: number) => i !== index);
      if (filtered.length > 0 && !filtered.some((a: any) => a.isPrimary)) {
        filtered[0] = { ...filtered[0], isPrimary: true };
      }
      return { ...m, addresses: filtered };
    });
  }

  setPrimaryAddress(index: number) {
    this.modelSignal().update((m: any) => {
      const currentAddresses = m.addresses || [];
      return {
        ...m,
        addresses: currentAddresses.map((addr: any, i: number) => ({
          ...addr,
          isPrimary: i === index,
        })),
      };
    });
  }
}
