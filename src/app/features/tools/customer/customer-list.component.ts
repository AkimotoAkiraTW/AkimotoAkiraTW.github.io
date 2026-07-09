import { Component, inject, ChangeDetectorRef, signal, effect, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CustomerService } from './customer.service';
import { Partner, CITIES } from './partner.model';
import { CategoryService } from './category.service';
import { preparePartnerForForm } from './partner-normalize';
import { CustomerFormComponent } from './customer-form.component';
import { PartnerDetailPanelComponent } from './partner-detail-panel.component';
import {
  PartnerConfirmDialogComponent,
  PartnerConfirmDialogData,
} from './partner-confirm-dialog.component';
import { partnerStatistics } from './partner-display.utils';
import { FilterSearchPanelComponent } from '../../../shared/components/filter-search-panel/filter-search-panel.component';
import { ResponsiveTableComponent, ColumnCellDirective } from '../../../shared/components/responsive-table/responsive-table.component';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    FilterSearchPanelComponent,
    ResponsiveTableComponent,
    ColumnCellDirective,
    PartnerDetailPanelComponent,
  ],
  template: `
    <div class="content-container" [class.detail-open]="!!selectedPartner()">
      <a mat-button routerLink="/tools" class="back-link">
        <mat-icon>arrow_back</mat-icon> 返回工具箱
      </a>
      <header class="page-header">
        <h1>離線商業夥伴管理</h1>
        <p>管理客戶與供應商（涵蓋零售、批發、企業、服務、農漁等情境），資料僅存於本機瀏覽器，可離線使用。</p>
      </header>

      <div class="crm-layout">
        <div class="crm-main">
          <div class="stats-row">
            <div class="stat-card">
              <span class="stat-value">{{ stats().total }}</span>
              <span class="stat-label">目前筆數</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{{ stats().customers }}</span>
              <span class="stat-label">客戶</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{{ stats().suppliers }}</span>
              <span class="stat-label">供應商</span>
            </div>
            <div class="stat-card is-highlight">
              <span class="stat-value">{{ stats().both }}</span>
              <span class="stat-label">客戶＋供應商</span>
            </div>
          </div>

          <div class="action-row">
            <span class="result-hint">顯示 {{ partners().length }} 筆</span>
            <button mat-raised-button color="primary" class="compact-btn" (click)="openForm()">
              <mat-icon>person_add</mat-icon> 新增商業夥伴
            </button>
          </div>

          <app-filter-search-panel
            [(search)]="searchQuery"
            [(city)]="selectedCity"
            [(type)]="selectedType"
            [(role)]="selectedRole"
            [(status)]="selectedStatus"
            [cities]="cities"
            placeholder="搜尋姓名、電話、產品/服務、產業、所在地、統編…"
          ></app-filter-search-panel>

          <app-responsive-table
            [data]="partners()"
            [displayedColumns]="displayedColumns"
            [columnLabels]="columnLabels"
            [rowClickable]="true"
            [selectedRowId]="selectedPartner()?.id"
            (rowActivate)="openDetail($event)"
          >
          <ng-template appColumnCell="name" let-element>
            <div class="name-cell-wrap">
              <div class="main-info">
                <span class="partner-name linkish">{{ element.displayName || '未命名' }}</span>
                <span class="badge" [class.badge-info]="element.partnerType === 'individual'" [class.badge-accent]="element.partnerType === 'enterprise'">
                  {{ element.partnerType === 'individual' ? '個人' : '法人' }}
                </span>
                <span class="badge" [class.badge-success]="element.isActive" [class.badge-muted]="!element.isActive">
                  {{ element.isActive ? '啟用' : '停用' }}
                </span>
              </div>

              @if (element.isCustomer || element.isSupplier || element.industry) {
                <div class="roles-badges">
                  @if (element.isCustomer) {
                    <span class="badge badge-accent">客戶</span>
                  }
                  @if (element.isSupplier) {
                    <span class="badge badge-warning">供應商</span>
                  }
                  @if (element.industry) {
                    <span class="badge">{{ element.industry }}</span>
                  }
                </div>
              }
            </div>
          </ng-template>

          <ng-template appColumnCell="phone" let-element>
            <span class="phone-cell">{{ element.primaryPhone || '—' }}</span>
          </ng-template>

          <ng-template appColumnCell="email" let-element>
            <span class="email-cell">{{ element.primaryEmail || '—' }}</span>
          </ng-template>

          <ng-template appColumnCell="city" let-element>
            @if (element.primaryCity) {
              <span class="city-chip">{{ element.primaryCity }}</span>
            } @else {
              <span class="city-chip is-empty">無地址</span>
            }
          </ng-template>

          <ng-template appColumnCell="actions" let-element>
            <div class="actions-cell" (click)="$event.stopPropagation()">
              <button mat-icon-button class="action-btn" (click)="openDetail(element)" title="檢視詳情">
                <mat-icon>visibility</mat-icon>
              </button>
              <button mat-icon-button color="primary" class="action-btn" (click)="openForm(element)" title="編輯">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" class="action-btn" (click)="confirmDelete(element)" title="刪除">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </ng-template>
        </app-responsive-table>
        </div>

        @if (selectedPartner(); as partner) {
          <div class="detail-backdrop" (click)="closeDetail()" aria-hidden="true"></div>
          <aside class="detail-drawer" role="complementary" aria-label="夥伴詳情">
            <app-partner-detail-panel
              [partner]="partner"
              (close)="closeDetail()"
              (edit)="editFromDetail()"
              (deletePartner)="confirmDelete(partner)"
            />
          </aside>
        }
      </div>
    </div>
  `,
  styles: [`
    .back-link {
      margin-bottom: 24px;
      opacity: 0.7;
      transition: opacity 200ms ease;
    }
    .back-link:hover { opacity: 1; }

    .crm-layout {
      display: flex;
      gap: 0;
      position: relative;
      align-items: flex-start;
    }

    .crm-main {
      flex: 1 1 auto;
      min-width: 0;
      width: 100%;
      padding-bottom: 72px;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--space-md);
      margin-bottom: var(--space-xl);
    }

    .action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-xl);
      gap: var(--space-md);
      flex-wrap: wrap;
    }

    .result-hint {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .name-cell-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px 0;
    }

    .main-info {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }

    .partner-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .partner-name.linkish {
      color: var(--accent-color);
    }

    .roles-badges {
      display: flex;
      gap: 6px;
      margin-top: 2px;
      flex-wrap: wrap;
    }

    .phone-cell {
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: 0.3px;
    }

    .email-cell {
      color: var(--text-muted);
      font-size: 13px;
    }

    .city-chip {
      background: var(--surface-alt);
      color: var(--text-secondary);
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 600;
      display: inline-block;
    }

    .city-chip.is-empty {
      background: transparent;
      color: var(--text-muted);
      border: 1px dashed var(--border-color);
      padding: 3px 9px;
    }

    .actions-cell {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-xs);
    }

    .action-btn {
      width: 34px !important;
      height: 34px !important;
      line-height: 34px !important;
      padding: 0 !important;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .action-btn .mat-icon,
    .action-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .detail-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      z-index: 1100;
    }

    @media (min-width: 960px) {
      .detail-backdrop { display: none; }
    }

    .detail-drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: min(420px, 100vw);
      height: 100vh;
      z-index: 1101;
      background: var(--surface-color);
      box-shadow: var(--shadow-lg);
      animation: slideIn 0.25s ease;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
  `],
})
export class CustomerListComponent {
  private customerService = inject(CustomerService);
  private categoryService = inject(CategoryService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  cities = CITIES;

  searchQuery = signal('');
  selectedCity = signal('');
  selectedType = signal('all');
  selectedRole = signal('all');
  selectedStatus = signal('all');

  selectedPartner = signal<Partner | null>(null);

  displayedColumns = ['name', 'phone', 'email', 'city', 'actions'];
  columnLabels: Record<string, string> = {
    name: '商業夥伴資訊 / 角色',
    phone: '聯絡電話',
    email: '電子信箱',
    city: '主要地址',
    actions: '操作功能',
  };

  partners = this.customerService.partnersSignal;

  stats = computed(() => partnerStatistics(this.partners()));

  constructor() {
    void this.categoryService.ensureDefaultCategories();

    effect(() => {
      this.customerService.setFilters(
        this.searchQuery(),
        this.selectedCity(),
        this.selectedType(),
        this.selectedRole(),
        this.selectedStatus()
      );
      this.cdr.markForCheck();
    });
  }

  openDetail(partner: Partner) {
    this.selectedPartner.set(partner);
  }

  closeDetail() {
    this.selectedPartner.set(null);
  }

  editFromDetail() {
    const partner = this.selectedPartner();
    if (partner) {
      this.openForm(partner);
    }
  }

  openForm(customer?: Partner) {
    const dialogRef = this.dialog.open(CustomerFormComponent, {
      data: { customer: customer ? preparePartnerForForm(customer) : undefined },
      panelClass: 'crm-partner-dialog',
      width: '880px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });

    dialogRef.afterClosed().subscribe((saved) => {
      if (saved) {
        if (customer?.id && this.selectedPartner()?.id === customer.id) {
          void this.refreshSelectedPartner(customer.id);
        }
        this.cdr.markForCheck();
      }
    });
  }

  async refreshSelectedPartner(id: string) {
    const updated = await this.customerService.getPartner(id);
    if (updated) {
      this.selectedPartner.set(updated);
    }
  }

  confirmDelete(partner: Partner) {
    if (!partner.id) return;
    const ref = this.dialog.open(PartnerConfirmDialogComponent, {
      width: '400px',
      data: {
        title: '確認刪除',
        message: `確定要刪除「${partner.displayName || '未命名'}」嗎？此操作無法復原。`,
        confirmLabel: '刪除',
      } satisfies PartnerConfirmDialogData,
    });
    ref.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed || !partner.id) return;
      await this.customerService.deletePartner(partner.id);
      if (this.selectedPartner()?.id === partner.id) {
        this.closeDetail();
      }
      this.cdr.markForCheck();
    });
  }
}
