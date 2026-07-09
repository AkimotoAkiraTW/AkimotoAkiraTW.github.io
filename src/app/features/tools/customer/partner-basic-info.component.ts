import {
  afterNextRender,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { PartnerFormValue, PartnerType } from './partner.model';
import { CategoryService } from './category.service';
import { emptyEnterprise, emptyIndividual } from './partner-normalize';
import {
  UiCheckboxFieldComponent,
  UiDateFieldComponent,
  UiFieldGroupComponent,
  UiSelectFieldComponent,
  UiTextFieldComponent,
  UiTextareaFieldComponent,
} from '../../../shared/components/form-primitives';

@Component({
  selector: 'app-partner-basic-info',
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    MatOptionModule,
    UiTextFieldComponent,
    UiSelectFieldComponent,
    UiTextareaFieldComponent,
    UiDateFieldComponent,
    UiCheckboxFieldComponent,
    UiFieldGroupComponent,
  ],
  template: `
    <div class="basic-info-container">
      <div class="surface-card">
        <h3 class="section-title"><mat-icon>settings</mat-icon> 核心設定</h3>
        <div class="core-grid">
          <div class="control-group">
            <span class="control-label">夥伴類型</span>
            <div class="segmented-control type-toggle">
              <button
                type="button"
                [class.active]="isIndividual()"
                (click)="setPartnerType('individual')"
              >個人</button>
              <button
                type="button"
                [class.active]="isEnterprise()"
                (click)="setPartnerType('enterprise')"
              >法人</button>
            </div>
          </div>

          <div class="checkbox-group">
            <ui-checkbox-field label="啟用此夥伴" [field]="form().isActive" />
            <ui-checkbox-field label="客戶（您銷售商品/服務給對方）" [field]="form().isCustomer" />
            <ui-checkbox-field label="供應商（對方提供商品/服務）" [field]="form().isSupplier" />
          </div>
        </div>

        <ui-text-field
          class="full-width"
          label="產業 / 行業別（選填）"
          [field]="form().industry"
          placeholder="例：電子零件、會計事務所、餐飲、水產…"
        />

        @if (isCustomer()) {
          <h4 class="subsection-title"><mat-icon>assignment_ind</mat-icon> 客戶設定</h4>
          <ui-field-group>
            <ui-text-field
              label="客戶編號（選填）"
              [field]="form().customer.customerCode"
              placeholder="例：C-001"
            />
            <ui-select-field label="客戶分類" [field]="form().customer.categoryId">
              <mat-option value="">未分類</mat-option>
              @for (c of categoryService.customerCategories(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </ui-select-field>
            <ui-text-field
              label="結帳日（1–31，選填）"
              type="number"
              [field]="form().customer.settlementDay"
              placeholder="1–31"
            />
            <ui-text-field
              class="col-span-2"
              label="付款條件（選填）"
              [field]="form().customer.paymentTerms"
              placeholder="例：月結 30 天、現金、貨到付款"
            />
          </ui-field-group>
        }
      </div>

      @if (isIndividual()) {
        <div class="surface-card">
          <h3 class="section-title"><mat-icon>face</mat-icon> 個人資料</h3>
          <ui-field-group>
            <ui-text-field
              label="姓氏"
              [field]="form().individual.lastName"
              placeholder="例：陳"
              errorFallback="此欄位必填"
            />
            <ui-text-field
              label="名字"
              [field]="form().individual.firstName"
              placeholder="例：阿明"
              errorFallback="此欄位必填"
            />
            <ui-text-field
              label="聯絡電話"
              [field]="form().individual.phone"
              placeholder="例：0912345678"
              errorFallback="聯絡電話必填"
            />
            <ui-text-field
              label="電子信箱"
              type="email"
              [field]="form().individual.email"
              placeholder="example@mail.com"
            />
            <ui-text-field
              label="身份證字號（選填）"
              [field]="form().individual.identificationNumber"
              placeholder="例：A123456789"
            />
            <ui-date-field
              label="生日（選填）"
              [field]="form().individual.birthDate"
            />
          </ui-field-group>
        </div>
      }

      @if (isEnterprise()) {
        <div class="surface-card">
          <h3 class="section-title"><mat-icon>business</mat-icon> 法人資料</h3>
          <ui-field-group>
            <ui-text-field
              class="col-span-2"
              label="公司／組織名稱"
              [field]="form().enterprise.companyName"
              placeholder="例：○○股份有限公司"
              errorFallback="名稱必填"
            />
            <ui-text-field
              label="統一編號（選填）"
              [field]="form().enterprise.businessID"
              placeholder="8 位數字"
            />
            <ui-text-field
              label="稅籍編號（選填）"
              [field]="form().enterprise.taxID"
            />
            <ui-text-field
              label="負責人（選填）"
              [field]="form().enterprise.responsiblePerson"
            />
            <ui-text-field
              label="公司電話（選填）"
              [field]="form().enterprise.phone"
            />
            <ui-text-field
              label="公司信箱（選填）"
              type="email"
              [field]="form().enterprise.email"
            />
          </ui-field-group>
        </div>
      }

      @if (isSupplier()) {
        <div class="surface-card">
          <h3 class="section-title"><mat-icon>local_shipping</mat-icon> 供應商設定</h3>
          <ui-field-group>
            <ui-text-field
              label="供應商編號（選填）"
              [field]="form().supplier.supplierCode"
              placeholder="例：S-001"
            />
            <ui-select-field label="供應商分類" [field]="form().supplier.categoryId">
              <mat-option value="">未分類</mat-option>
              @for (c of categoryService.supplierCategories(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </ui-select-field>
            <ui-text-field
              class="col-span-2"
              label="主要產品 / 服務（逗號分隔）"
              [ngModel]="mainProductsText()"
              (ngModelChange)="onMainProductsAdapter($event)"
              placeholder="例：螺絲, 鋼板  或  記帳, 稅務申報  或  高麗菜, 虱目魚"
            />
            <ui-text-field
              label="來源地 / 所在地（選填）"
              [field]="form().supplier.sourceLocation"
              placeholder="例：台中工廠、雲林崙背、台北辦公室"
            />
            <ui-text-field
              label="付款條件（選填）"
              [field]="form().supplier.paymentTerms"
              placeholder="例：月結 60 天、預付、現金"
            />
            <ui-text-field
              class="col-span-2"
              label="交期 / 供貨備註（選填）"
              [field]="form().supplier.leadTimeNotes"
              placeholder="例：下單後 3–5 天到貨、產季 10–3 月"
            />
            <ui-text-field
              class="col-span-2"
              label="交貨條件（選填）"
              [field]="form().supplier.deliveryTerms"
              placeholder="例：自取、宅配、貨運、線上交付"
            />
          </ui-field-group>
        </div>
      }

      <div class="surface-card">
        <h3 class="section-title"><mat-icon>notes</mat-icon> 備註</h3>
        <ui-textarea-field
          class="full-width"
          label="一般備註"
          [field]="form().notes"
          [rows]="3"
        />
      </div>
    </div>
  `,
  styles: [`
    .basic-info-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-xl);
      padding: var(--space-xs);
    }

    .surface-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .core-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-xl);
    }

    @media (min-width: 600px) {
      .core-grid {
        grid-template-columns: 1.2fr 1fr;
        align-items: center;
      }
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .control-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-secondary);
    }

    .subsection-title {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin: var(--space-md) 0 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .subsection-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--accent-color);
    }

    .type-toggle {
      display: flex;
      height: 42px;
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .full-width { width: 100%; }
  `],
})
export class PartnerBasicInfoComponent {
  form = input.required<any>();
  modelSignal = input.required<any>();

  readonly categoryService = inject(CategoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);

  readonly isIndividual = computed(() => this.modelSignal()().partnerType === 'individual');
  readonly isEnterprise = computed(() => this.modelSignal()().partnerType === 'enterprise');
  readonly isCustomer = computed(() => !!this.modelSignal()().isCustomer);
  readonly isSupplier = computed(() => !!this.modelSignal()().isSupplier);

  constructor() {
    effect(() => {
      if (this.isCustomer() || this.isSupplier()) {
        afterNextRender(
          () => {
            this.cdr.detectChanges();
            requestAnimationFrame(() => this.cdr.detectChanges());
          },
          { injector: this.injector },
        );
      }
    });
  }

  mainProductsText(): string {
    const items = this.modelSignal()().supplier?.mainProducts;
    return items?.length ? items.join(', ') : '';
  }

  onMainProductsAdapter(value: string | number | null) {
    const items = String(value ?? '')
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    this.modelSignal().update((m: PartnerFormValue) => ({
      ...m,
      supplier: { ...m.supplier, mainProducts: items },
    }));
  }

  setPartnerType(type: PartnerType) {
    this.modelSignal().update((m: PartnerFormValue) => ({
      ...m,
      partnerType: type,
      individual: m.individual ?? emptyIndividual(),
      enterprise: m.enterprise ?? emptyEnterprise(),
    }));
  }
}
