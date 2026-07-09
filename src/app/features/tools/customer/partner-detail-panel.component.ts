import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Partner } from './partner.model';
import { CategoryService } from './category.service';
import {
  formatAddressLine,
  formatDateTime,
  formatPartnerRoles,
  resolveCategoryName,
} from './partner-display.utils';

@Component({
  selector: 'app-partner-detail-panel',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatDividerModule],
  template: `
    @if (partner(); as p) {
    <div class="detail-panel">
      <header class="detail-header">
        <div class="header-text">
          <h2>{{ p.displayName || '未命名' }}</h2>
          <p class="subtitle">{{ roleSummary() }}</p>
        </div>
        <button mat-icon-button type="button" (click)="close.emit()" aria-label="關閉">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <div class="detail-badges">
        <span class="badge" [class.badge-info]="p.partnerType === 'individual'" [class.badge-accent]="p.partnerType === 'enterprise'">
          {{ p.partnerType === 'individual' ? '個人' : '法人' }}
        </span>
        <span class="badge" [class.badge-success]="p.isActive" [class.badge-muted]="!p.isActive">
          {{ p.isActive ? '啟用' : '停用' }}
        </span>
        @if (p.isCustomer) {
          <span class="badge badge-accent">客戶</span>
        }
        @if (p.isSupplier) {
          <span class="badge badge-warning">供應商</span>
        }
        @if (p.industry) {
          <span class="badge">{{ p.industry }}</span>
        }
      </div>

      <div class="detail-body">
        <section class="detail-section">
          <h3>聯絡方式</h3>
          <dl>
            <dt>電話</dt>
            <dd>{{ p.primaryPhone || '—' }}</dd>
            <dt>信箱</dt>
            <dd>{{ p.primaryEmail || '—' }}</dd>
            <dt>主要縣市</dt>
            <dd>{{ p.primaryCity || '—' }}</dd>
            <dt>產業 / 行業別（選填）</dt>
            <dd>{{ p.industry || '—' }}</dd>
          </dl>
        </section>

        @if (p.partnerType === 'individual' && p.individual) {
          <section class="detail-section">
            <h3>個人資料</h3>
            <dl>
              <dt>姓氏</dt>
              <dd>{{ p.individual.lastName || '—' }}</dd>
              <dt>名字</dt>
              <dd>{{ p.individual.firstName || '—' }}</dd>
              <dt>聯絡電話</dt>
              <dd>{{ p.individual.phone || '—' }}</dd>
              <dt>電子信箱</dt>
              <dd>{{ p.individual.email || '—' }}</dd>
              <dt>身份證字號（選填）</dt>
              <dd>{{ p.individual.identificationNumber || '—' }}</dd>
              <dt>生日（選填）</dt>
              <dd>{{ p.individual.birthDate || '—' }}</dd>
            </dl>
          </section>
        }

        @if (p.partnerType === 'enterprise' && p.enterprise) {
          <section class="detail-section">
            <h3>法人資料</h3>
            <dl>
              <dt>公司／組織名稱</dt>
              <dd>{{ p.enterprise.companyName }}</dd>
              <dt>統一編號（選填）</dt>
              <dd>{{ p.enterprise.businessID || '—' }}</dd>
              <dt>稅籍編號（選填）</dt>
              <dd>{{ p.enterprise.taxID || '—' }}</dd>
              <dt>負責人（選填）</dt>
              <dd>{{ p.enterprise.responsiblePerson || '—' }}</dd>
              <dt>公司電話（選填）</dt>
              <dd>{{ p.enterprise.phone || '—' }}</dd>
              <dt>公司信箱（選填）</dt>
              <dd>{{ p.enterprise.email || '—' }}</dd>
            </dl>
          </section>
        }

        @if (p.isCustomer && p.customer) {
          <section class="detail-section">
            <h3>客戶設定</h3>
            <dl>
              <dt>客戶編號（選填）</dt>
              <dd>{{ p.customer.customerCode || '—' }}</dd>
              <dt>客戶分類</dt>
              <dd>{{ customerCategoryName() }}</dd>
              <dt>結帳日（1–31，選填）</dt>
              <dd>{{ p.customer.settlementDay ? '每月 ' + p.customer.settlementDay + ' 日' : '—' }}</dd>
              <dt>付款條件（選填）</dt>
              <dd>{{ p.customer.paymentTerms || '—' }}</dd>
            </dl>
          </section>
        }

        @if (p.isSupplier && p.supplier) {
          <section class="detail-section">
            <h3>供應商設定</h3>
            <dl>
              <dt>供應商編號（選填）</dt>
              <dd>{{ p.supplier.supplierCode || '—' }}</dd>
              <dt>供應商分類</dt>
              <dd>{{ supplierCategoryName() }}</dd>
              <dt>主要產品 / 服務（逗號分隔）</dt>
              <dd>{{ p.supplier.mainProducts?.length ? (p.supplier.mainProducts?.join('、') ?? '—') : '—' }}</dd>
              <dt>來源地 / 所在地（選填）</dt>
              <dd>{{ p.supplier.sourceLocation || '—' }}</dd>
              <dt>付款條件（選填）</dt>
              <dd>{{ p.supplier.paymentTerms || '—' }}</dd>
              <dt>交期 / 供貨備註（選填）</dt>
              <dd>{{ p.supplier.leadTimeNotes || '—' }}</dd>
              <dt>交貨條件（選填）</dt>
              <dd>{{ p.supplier.deliveryTerms || '—' }}</dd>
            </dl>
          </section>
        }

        @if (p.addresses.length) {
          <section class="detail-section">
            <h3>地址（{{ p.addresses.length }}）</h3>
            <ul class="item-list">
              @for (addr of p.addresses; track addr.id) {
                <li [class.is-primary]="addr.isPrimary">
                  @if (addr.isPrimary) {
                    <span class="item-tag">主要</span>
                  }
                  {{ formatAddressLine(addr) }}
                </li>
              }
            </ul>
          </section>
        }

        @if (p.additionalContacts.length) {
          <section class="detail-section">
            <h3>額外聯絡人（{{ p.additionalContacts.length }}）</h3>
            <ul class="item-list">
              @for (c of p.additionalContacts; track c.id) {
                <li [class.is-primary]="c.isPrimary">
                  @if (c.isPrimary) {
                    <span class="item-tag">主要</span>
                  }
                  <strong>{{ c.name }}</strong>
                  @if (c.role) {
                    <span> · {{ c.role }}</span>
                  }
                  <br />
                  <span class="muted">{{ c.phone || '—' }} · {{ c.email || '—' }}</span>
                </li>
              }
            </ul>
          </section>
        }

        @if (p.notes) {
          <section class="detail-section">
            <h3>備註</h3>
            <dl>
              <dt>一般備註</dt>
              <dd class="notes">{{ p.notes }}</dd>
            </dl>
          </section>
        }

        <section class="detail-section meta">
          <dl>
            <dt>建立時間</dt>
            <dd>{{ formatDateTime(p.createdAt) }}</dd>
            <dt>最後更新</dt>
            <dd>{{ formatDateTime(p.updatedAt) }}</dd>
          </dl>
        </section>
      </div>

      <footer class="detail-footer">
        <button mat-stroked-button type="button" (click)="edit.emit()">
          <mat-icon>edit</mat-icon> 編輯
        </button>
        <button mat-stroked-button color="warn" type="button" (click)="deletePartner.emit()">
          <mat-icon>delete</mat-icon> 刪除
        </button>
      </footer>
    </div>
    }
  `,
  styles: [`
    .detail-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--surface-color);
      color: var(--text-primary);
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--space-xl) var(--space-xl) var(--space-md);
      border-bottom: 1px solid var(--border-color);
      gap: var(--space-md);
    }

    .header-text h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    .subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-muted);
    }

    .detail-badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
      padding: var(--space-md) var(--space-xl);
    }

    .detail-body {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-sm) var(--space-xl) var(--space-xl);
    }

    .detail-section { margin-bottom: var(--space-xl); }

    .detail-section h3 {
      margin: 0 0 var(--space-sm);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-muted);
    }

    dl {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: var(--space-sm) var(--space-md);
      margin: 0;
      font-size: 14px;
    }

    dt {
      color: var(--text-muted);
      font-weight: 600;
    }

    dd {
      margin: 0;
      color: var(--text-primary);
      word-break: break-word;
    }

    .item-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .item-list li {
      padding: var(--space-sm) var(--space-md);
      border-radius: var(--radius-md);
      background: var(--surface-alt);
      font-size: 13px;
      line-height: 1.5;
      border: 1px solid transparent;
    }

    .item-list li.is-primary {
      border-color: var(--accent-color);
      background: var(--accent-softer);
    }

    .item-tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-sm);
      background: var(--accent-color);
      color: var(--accent-on);
      margin-right: 6px;
    }

    .muted {
      color: var(--text-muted);
      font-size: 12px;
    }

    .notes {
      margin: 0;
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-secondary);
    }

    .detail-section.meta {
      border-top: 1px dashed var(--border-color);
      padding-top: var(--space-lg);
    }

    .detail-footer {
      display: flex;
      gap: var(--space-sm);
      padding: var(--space-md) var(--space-xl);
      border-top: 1px solid var(--border-color);
      background: var(--surface-alt);
    }

    .detail-footer button { flex: 1; }
  `],
})
export class PartnerDetailPanelComponent {
  private categoryService = inject(CategoryService);

  partner = input.required<Partner>();
  close = output<void>();
  edit = output<void>();
  deletePartner = output<void>();

  readonly formatAddressLine = formatAddressLine;
  readonly formatDateTime = formatDateTime;

  roleSummary = computed(() => formatPartnerRoles(this.partner()));

  customerCategoryName = computed(() =>
    resolveCategoryName(
      this.partner().customer?.categoryId,
      this.categoryService.customerCategories()
    )
  );

  supplierCategoryName = computed(() =>
    resolveCategoryName(
      this.partner().supplier?.categoryId,
      this.categoryService.supplierCategories()
    )
  );
}
