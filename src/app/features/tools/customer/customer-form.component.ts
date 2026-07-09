import { afterNextRender, Component, Inject, inject, ChangeDetectorRef, signal } from '@angular/core';
import { form, submit, required, pattern, applyEach, hidden } from '@angular/forms/signals';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PartnerBasicInfoComponent } from './partner-basic-info.component';
import { PartnerAddressesComponent } from './partner-addresses.component';
import { PartnerContactsComponent } from './partner-contacts.component';
import { CustomerService } from './customer.service';
import { CategoryService } from './category.service';
import { Partner, PartnerFormValue } from './partner.model';
import { createEmptyPartner, preparePartnerForForm } from './partner-normalize';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    PartnerBasicInfoComponent,
    PartnerAddressesComponent,
    PartnerContactsComponent,
  ],
  template: `
    <div class="crm-form-shell">
      <h2 mat-dialog-title class="form-title">
        <mat-icon>{{ data?.customer ? 'edit' : 'person_add' }}</mat-icon>
        {{ data?.customer ? '編輯商業夥伴' : '新增商業夥伴' }}
      </h2>

      <mat-dialog-content class="form-content">
        <form class="crm-form" (submit)="onSubmit(); $event.preventDefault()">
          <mat-tab-group class="form-tabs" animationDuration="200ms">
            <mat-tab label="基本資訊">
              <div class="tab-padding">
                <app-partner-basic-info [form]="partnerForm" [modelSignal]="model"></app-partner-basic-info>
              </div>
            </mat-tab>

            <mat-tab label="地址管理">
              <div class="tab-padding">
                <app-partner-addresses [form]="partnerForm" [modelSignal]="model"></app-partner-addresses>
              </div>
            </mat-tab>

            <mat-tab label="聯絡窗口">
              <div class="tab-padding">
                <app-partner-contacts [form]="partnerForm" [modelSignal]="model"></app-partner-contacts>
              </div>
            </mat-tab>
          </mat-tab-group>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="form-actions">
        <button mat-button mat-dialog-close type="button">取消</button>
        <button
          mat-raised-button
          color="primary"
          type="button"
          class="compact-btn"
          [disabled]="partnerForm().invalid() || partnerForm().pending()"
          (click)="onSubmit()"
        >
          <mat-icon>save</mat-icon> 儲存資料
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-height: inherit;
    }

    .crm-form-shell {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-height: 90vh;
      min-height: 0;
    }

    .form-title {
      flex: 0 0 auto;
      font-size: 1.125rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin: 0 !important;
      padding: var(--space-xl) var(--space-2xl) var(--space-md) !important;
      color: var(--text-primary);
    }

    .form-title mat-icon {
      color: var(--accent-color);
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .form-content {
      flex: 1 1 auto;
      min-height: 0;
      width: 100% !important;
      max-width: 100% !important;
      max-height: none !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: hidden;
    }

    .crm-form {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .form-tabs {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: min(56vh, 520px);
      max-height: min(56vh, 520px);
    }

    .form-tabs ::ng-deep .mat-mdc-tab-header {
      flex: 0 0 auto;
      border-bottom: 1px solid var(--border-color);
      padding: 0 var(--space-lg);
    }

    .form-tabs ::ng-deep .mat-mdc-tab-body-wrapper {
      flex: 1 1 auto;
      min-height: 0;
    }

    .form-tabs ::ng-deep .mat-mdc-tab-body-content {
      overflow-x: hidden;
      overflow-y: visible;
    }

    .form-tabs ::ng-deep .mat-mdc-tab .mdc-tab-indicator__content--underline {
      border-color: var(--accent-color) !important;
    }

    .form-tabs ::ng-deep .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
      color: var(--accent-color) !important;
      font-weight: 700 !important;
    }

    .form-tabs ::ng-deep .mdc-tab__text-label {
      font-weight: 600 !important;
      font-size: 14px !important;
    }

    .tab-padding {
      padding: var(--space-xl) var(--space-2xl) var(--space-2xl);
      height: 100%;
      max-height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      box-sizing: border-box;
      -webkit-overflow-scrolling: touch;
    }

    .form-actions {
      flex: 0 0 auto;
      padding: var(--space-md) var(--space-xl) !important;
      border-top: 1px solid var(--border-color);
      background: var(--surface-alt);
      margin: 0 !important;
      gap: var(--space-sm);
    }

    @media (max-width: 600px) {
      .form-title {
        padding: var(--space-lg) var(--space-lg) var(--space-sm) !important;
        font-size: 1rem;
      }

      .tab-padding { padding: var(--space-lg); }

      .form-tabs {
        min-height: min(62vh, 480px);
        max-height: min(62vh, 480px);
      }

      .form-actions {
        flex-wrap: wrap;
        justify-content: stretch !important;
      }

      .form-actions button { flex: 1 1 auto; }
    }
  `],
})
export class CustomerFormComponent {
  private customerService = inject(CustomerService);
  private categoryService = inject(CategoryService);
  private dialogRef = inject(MatDialogRef<CustomerFormComponent>);
  private cdr = inject(ChangeDetectorRef);

  model = signal<PartnerFormValue>(createEmptyPartner());

  partnerForm = form(this.model, (s) => {
    required(s.partnerType);

    hidden(s.individual, ({ valueOf }) => valueOf(s.partnerType) !== 'individual');
    required(s.individual.lastName, {
      when: ({ valueOf }) => valueOf(s.partnerType) === 'individual',
    });
    required(s.individual.firstName, {
      when: ({ valueOf }) => valueOf(s.partnerType) === 'individual',
    });
    required(s.individual.phone, {
      when: ({ valueOf }) => valueOf(s.partnerType) === 'individual',
      message: '聯絡電話必填',
    });
    pattern(s.individual.identificationNumber, /^$|^[A-Z][1-2]\d{8}$/, {
      message: '身分證格式錯誤，必須大寫字母開頭且共10碼',
    });

    hidden(s.enterprise, ({ valueOf }) => valueOf(s.partnerType) !== 'enterprise');
    required(s.enterprise.companyName, {
      when: ({ valueOf }) => valueOf(s.partnerType) === 'enterprise',
    });
    pattern(s.enterprise.businessID, /^$|^\d{8}$/, {
      message: '統一編號必須為 8 位數字',
    });

    hidden(s.customer, ({ valueOf }) => !valueOf(s.isCustomer));
    hidden(s.supplier, ({ valueOf }) => !valueOf(s.isSupplier));

    applyEach(s.addresses, (addr) => {
      required(addr.address, { message: '詳細地址必填' });
      required(addr.city, { message: '所屬縣市必填' });
    });

    applyEach(s.additionalContacts, (contact) => {
      required(contact.name, { message: '聯絡人姓名必填' });
      pattern(contact.phone, /^$|^[0-9+\-\s()]{8,15}$/, {
        message: '電話格式錯誤',
      });
    });
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: { customer?: Partner } | null) {
    void this.categoryService.ensureDefaultCategories();
    if (this.data?.customer) {
      const clone =
        typeof structuredClone === 'function'
          ? structuredClone(this.data.customer)
          : JSON.parse(JSON.stringify(this.data.customer));
      this.model.set(preparePartnerForForm(clone));
    }
    afterNextRender(() => this.cdr.detectChanges());
  }

  onSubmit() {
    submit(this.partnerForm, async () => {
      await this.customerService.savePartner(this.model());
      this.dialogRef.close(true);
      this.cdr.markForCheck();
    });
  }
}
