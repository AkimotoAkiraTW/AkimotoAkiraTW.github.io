import { Component, input, model, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

interface ActiveBadge {
  id: string;
  label: string;
}

@Component({
  selector: 'app-filter-search-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  template: `
    <div class="filter-panel surface-card">
      <div class="filter-inputs-grid">
        <div class="input-wrapper search-wrapper">
          <label class="field-label">關鍵字搜尋</label>
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              [placeholder]="placeholder()"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              class="search-input"
            />
            <button
              *ngIf="search()"
              mat-icon-button
              class="clear-input-btn"
              (click)="search.set('')"
              type="button"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <div class="input-wrapper">
          <label class="field-label">所屬縣市</label>
          <mat-form-field appearance="outline" class="filter-select">
            <mat-select [ngModel]="city()" (ngModelChange)="city.set($event)">
              <mat-option value="">全部縣市</mat-option>
              <mat-option *ngFor="let c of cities()" [value]="c">{{ c }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="input-wrapper">
          <label class="field-label">夥伴類型</label>
          <div class="segmented-control">
            <button type="button" [class.active]="type() === 'all'" (click)="type.set('all')">全部</button>
            <button type="button" [class.active]="type() === 'individual'" (click)="type.set('individual')">個人</button>
            <button type="button" [class.active]="type() === 'enterprise'" (click)="type.set('enterprise')">法人</button>
          </div>
        </div>

        <div class="input-wrapper">
          <label class="field-label">業務角色</label>
          <div class="segmented-control">
            <button type="button" [class.active]="role() === 'all'" (click)="role.set('all')">全部</button>
            <button type="button" [class.active]="role() === 'customer'" (click)="role.set('customer')">客戶</button>
            <button type="button" [class.active]="role() === 'supplier'" (click)="role.set('supplier')">供應商</button>
            <button type="button" [class.active]="role() === 'both'" (click)="role.set('both')">客供</button>
          </div>
        </div>

        <div class="input-wrapper">
          <label class="field-label">啟用狀態</label>
          <div class="segmented-control">
            <button type="button" [class.active]="status() === 'all'" (click)="status.set('all')">全部</button>
            <button type="button" [class.active]="status() === 'active'" (click)="status.set('active')">啟用</button>
            <button type="button" [class.active]="status() === 'inactive'" (click)="status.set('inactive')">停用</button>
          </div>
        </div>
      </div>

      <div class="active-filters-row" *ngIf="badges().length > 0">
        <span class="active-label">目前篩選：</span>
        <div class="badges-list">
          <span
            *ngFor="let b of badges(); trackBy: trackByBadgeId"
            class="filter-badge"
          >
            {{ b.label }}
            <button class="badge-close-btn" (click)="clearBadge(b.id)" type="button">
              <mat-icon>close</mat-icon>
            </button>
          </span>
          <button class="clear-all-btn" (click)="resetAll()" type="button">清除全部</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filter-panel {
      margin-bottom: var(--space-2xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-xl);
    }

    .filter-panel:hover { border-color: var(--accent-color); }

    .filter-inputs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--space-xl);
      align-items: flex-end;
    }

    .input-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .field-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: 0.3px;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: var(--surface-alt);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 0 12px;
      height: 48px;
      transition: background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .search-box:focus-within {
      background: var(--surface-color);
      border-color: var(--accent-color);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .search-icon {
      color: var(--text-muted);
      margin-right: 8px;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      height: 100%;
      font-size: 14px;
      color: var(--text-primary);
      font-family: inherit;
    }

    .search-input::placeholder { color: var(--text-muted); }

    .clear-input-btn {
      width: 28px !important;
      height: 28px !important;
      line-height: 28px !important;
      padding: 0 !important;
      color: var(--text-muted);
    }

    .clear-input-btn .mat-icon,
    .clear-input-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .filter-select { width: 100%; }
    .filter-select ::ng-deep .mat-mdc-text-field-wrapper {
      height: 48px !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      background-color: var(--surface-alt) !important;
      border-radius: var(--radius-md) !important;
    }
    .filter-select ::ng-deep .mat-mdc-form-field-flex {
      height: 48px !important;
      align-items: center !important;
    }
    .filter-select ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      display: flex;
      align-items: center;
    }
    .filter-select ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none !important; }
    .filter-select ::ng-deep .mat-mdc-outlined-text-field-wrapper .mdc-notched-outline {
      border-color: var(--border-color) !important;
    }
    .filter-select:focus-within ::ng-deep .mdc-notched-outline {
      border-color: var(--accent-color) !important;
      border-width: 2px !important;
    }

    .segmented-control {
      display: flex;
      height: 48px;
      padding: 4px;
    }

    .segmented-control button {
      padding: 0 12px;
    }

    .active-filters-row {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      border-top: 1px dashed var(--border-color);
      padding-top: var(--space-lg);
      flex-wrap: wrap;
    }

    .active-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .badges-list {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }

    .filter-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--accent-soft);
      color: var(--accent-color);
      border-radius: var(--radius-pill);
      padding: 4px 4px 4px 12px;
      font-size: 12px;
      font-weight: 600;
      transition: background var(--transition-fast);
    }

    .filter-badge:hover { background: var(--accent-color); color: var(--accent-on); }

    .badge-close-btn {
      border: none;
      background: transparent;
      padding: 0;
      color: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .badge-close-btn:hover { opacity: 1; }

    .badge-close-btn .mat-icon,
    .badge-close-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .clear-all-btn {
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      transition: color var(--transition-fast), background var(--transition-fast);
    }

    .clear-all-btn:hover {
      color: var(--state-danger);
      background: var(--state-danger-soft);
    }
  `],
})
export class FilterSearchPanelComponent {
  placeholder = input<string>('搜尋關鍵字...');
  cities = input<string[]>([]);

  search = model<string>('');
  city = model<string>('');
  type = model<string>('all');
  role = model<string>('all');
  status = model<string>('all');

  badges = computed<ActiveBadge[]>(() => {
    const list: ActiveBadge[] = [];

    if (this.search()) {
      list.push({ id: 'search', label: `關鍵字: "${this.search()}"` });
    }

    if (this.city()) {
      list.push({ id: 'city', label: `縣市: ${this.city()}` });
    }

    if (this.type() !== 'all') {
      const typeLabel = this.type() === 'individual' ? '個人' : '法人';
      list.push({ id: 'type', label: `類型: ${typeLabel}` });
    }

    if (this.role() !== 'all') {
      const roleMap: Record<string, string> = {
        customer: '客戶',
        supplier: '供應商',
        both: '客戶+供應商',
      };
      list.push({ id: 'role', label: `角色: ${roleMap[this.role()] ?? this.role()}` });
    }

    if (this.status() !== 'all') {
      const statusLabel = this.status() === 'active' ? '啟用' : '停用';
      list.push({ id: 'status', label: `狀態: ${statusLabel}` });
    }

    return list;
  });

  trackByBadgeId(_index: number, item: ActiveBadge): string {
    return item.id;
  }

  clearBadge(id: string) {
    if (id === 'search') this.search.set('');
    if (id === 'city') this.city.set('');
    if (id === 'type') this.type.set('all');
    if (id === 'role') this.role.set('all');
    if (id === 'status') this.status.set('all');
  }

  resetAll() {
    this.search.set('');
    this.city.set('');
    this.type.set('all');
    this.role.set('all');
    this.status.set('all');
  }
}
