import { ChangeDetectorRef, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { generateLocalId } from './partner-normalize';
import { UiFieldGroupComponent, UiTextFieldComponent } from '../../../shared/components/form-primitives';

@Component({
  selector: 'app-partner-contacts',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    UiTextFieldComponent,
    UiFieldGroupComponent,
  ],
  template: `
    <div class="contacts-container">
      <div class="header-row">
        <span class="section-subtitle">
          額外聯絡人（共 {{ modelSignal()().additionalContacts.length }} 筆）
        </span>
        <button type="button" mat-stroked-button color="primary" class="compact-btn" (click)="addContact()">
          <mat-icon>person_add</mat-icon> 新增聯絡人
        </button>
      </div>

      <div class="cards-list">
        @for (contact of modelSignal()().additionalContacts; track contact.id; let idx = $index) {
          @if (idx < form().additionalContacts.length) {
            <div class="surface-card item-card" [class.is-primary]="form().additionalContacts[idx].isPrimary().value()">
              <div class="card-header">
                <span class="card-index">聯絡人 #{{ idx + 1 }}</span>
                <div class="card-actions">
                  @if (form().additionalContacts[idx].isPrimary().value()) {
                    <span class="badge badge-success primary-tag">
                      <mat-icon>star</mat-icon> 主要聯絡人
                    </span>
                  } @else {
                    <button
                      type="button"
                      mat-icon-button
                      (click)="setPrimaryContact(idx)"
                      title="設為主要聯絡人"
                      class="icon-btn"
                    >
                      <mat-icon>star_border</mat-icon>
                    </button>
                  }
                  <button
                    type="button"
                    mat-icon-button
                    color="warn"
                    (click)="removeContact(idx)"
                    title="刪除聯絡人"
                    class="icon-btn"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <ui-field-group class="contact-grid" layout="grid">
                <ui-text-field
                  label="聯絡人姓名"
                  [field]="form().additionalContacts[idx].name"
                  placeholder="例：王小明"
                  errorFallback="姓名必填"
                />
                <ui-text-field
                  label="聯絡電話"
                  [field]="form().additionalContacts[idx].phone"
                  placeholder="例：0912345678"
                  errorFallback="電話必填"
                />
                <ui-text-field
                  label="電子信箱"
                  type="email"
                  [field]="form().additionalContacts[idx].email"
                  placeholder="example@domain.com"
                />
                <ui-text-field
                  label="角色 / 職務"
                  [field]="form().additionalContacts[idx].role"
                  placeholder="例：採購、會計、業務窗口、配偶"
                />
                <ui-text-field
                  class="col-span-full"
                  label="備註"
                  [field]="form().additionalContacts[idx].notes"
                  placeholder="其他補充資料..."
                />
              </ui-field-group>
            </div>
          }
        }

        @if (modelSignal()().additionalContacts.length === 0) {
          <div class="empty-state">
            <mat-icon>person_off</mat-icon>
            <p>個人夥伴通常不需額外聯絡人；法人或團隊可新增採購、會計、業務等窗口。</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .contacts-container {
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

    .contact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--space-md);
    }

    .contact-grid .col-span-full { grid-column: 1 / -1; }

    .contact-grid ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: block !important;
    }
  `],
})
export class PartnerContactsComponent {
  form = input.required<any>();
  modelSignal = input.required<any>();

  private readonly cdr = inject(ChangeDetectorRef);

  addContact() {
    this.modelSignal().update((m: any) => {
      const currentContacts = m.additionalContacts || [];
      const newContact = {
        id: generateLocalId(),
        name: '',
        phone: '',
        email: '',
        role: '',
        notes: '',
        isPrimary: currentContacts.length === 0,
      };
      return {
        ...m,
        additionalContacts: [...currentContacts, newContact],
      };
    });
    queueMicrotask(() => this.cdr.detectChanges());
  }

  removeContact(index: number) {
    this.modelSignal().update((m: any) => {
      const currentContacts = m.additionalContacts || [];
      const filtered = currentContacts.filter((_: any, i: number) => i !== index);
      if (filtered.length > 0 && !filtered.some((c: any) => c.isPrimary)) {
        filtered[0] = { ...filtered[0], isPrimary: true };
      }
      return { ...m, additionalContacts: filtered };
    });
  }

  setPrimaryContact(index: number) {
    this.modelSignal().update((m: any) => {
      const currentContacts = m.additionalContacts || [];
      return {
        ...m,
        additionalContacts: currentContacts.map((contact: any, i: number) => ({
          ...contact,
          isPrimary: i === index,
        })),
      };
    });
  }
}
