import { Component, input, ContentChildren, QueryList, TemplateRef, Directive, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Directive({
  selector: '[appColumnCell]',
  standalone: true,
})
export class ColumnCellDirective {
  columnName = input.required<string>({ alias: 'appColumnCell' });
  constructor(public templateRef: TemplateRef<any>) {}
}

@Component({
  selector: 'app-responsive-table',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="responsive-container">
      <!-- Desktop table -->
      <div class="desktop-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th *ngFor="let col of displayedColumns()" [class]="'col-' + col">
                {{ columnLabels()[col] || col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let row of data(); let idx = index"
              class="table-row"
              [class.is-clickable]="rowClickable()"
              [class.is-selected]="rowClickable() && selectedRowId() === row['id']"
              (click)="onRowClick(row, $event)"
            >
              <td *ngFor="let col of displayedColumns()" [class]="'cell-' + col">
                <ng-container *ngIf="getTemplate(col) as tpl; else defaultCell">
                  <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, index: idx }"></ng-container>
                </ng-container>
                <ng-template #defaultCell>{{ row[col] }}</ng-template>
              </td>
            </tr>

            <tr *ngIf="data().length === 0">
              <td [attr.colspan]="displayedColumns().length" class="empty-cell">
                <div class="empty-state">
                  <mat-icon>inbox</mat-icon>
                  <p>尚無任何資料記錄</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="mobile-grid">
        <div
          *ngFor="let row of data(); let idx = index"
          class="surface-card mobile-card"
          [class.is-selected]="rowClickable() && selectedRowId() === row['id']"
          [class.is-clickable]="rowClickable()"
          (click)="onRowClick(row, $event)"
        >
          <div class="card-content">
            <div *ngFor="let col of mobileDisplayedColumns()" class="field-row">
              <span class="field-label">{{ columnLabels()[col] || col }}</span>
              <div class="field-value">
                <ng-container *ngIf="getTemplate(col) as tpl; else defaultCellMobile">
                  <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, index: idx }"></ng-container>
                </ng-container>
                <ng-template #defaultCellMobile>{{ row[col] }}</ng-template>
              </div>
            </div>
          </div>

          <div class="card-actions" *ngIf="hasActionsColumn()">
            <ng-container *ngIf="getTemplate('actions') as actionsTpl">
              <ng-container *ngTemplateOutlet="actionsTpl; context: { $implicit: row, index: idx }"></ng-container>
            </ng-container>
          </div>
        </div>

        <div *ngIf="data().length === 0" class="empty-state mobile-empty">
          <mat-icon>inbox</mat-icon>
          <p>尚無任何資料記錄</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .responsive-container { width: 100%; position: relative; }

    /* ── Desktop Table ── */
    .desktop-wrapper {
      display: block;
      width: 100%;
      border-radius: var(--radius-xl);
      overflow-x: auto;
      overflow-y: hidden;
      border: 1px solid var(--border-color);
      background: var(--surface-color);
      box-shadow: var(--shadow-sm);
    }

    @media (max-width: 768px) {
      .desktop-wrapper { display: none; }
    }

    .data-table {
      width: 100%;
      min-width: 720px;
      border-collapse: collapse;
      text-align: left;
      font-size: 14px;
      table-layout: auto;
    }

    .data-table thead {
      background: var(--surface-alt);
      border-bottom: 1px solid var(--border-color);
    }

    .data-table thead th {
      padding: var(--space-lg) var(--space-2xl);
      font-weight: 700;
      color: var(--text-secondary);
      letter-spacing: 0.5px;
      font-size: 12px;
      text-transform: uppercase;
    }

    .data-table tbody tr.table-row {
      border-bottom: 1px solid var(--border-color);
      background: var(--surface-color);
      transition: background var(--transition-fast);
    }

    .data-table tbody tr.table-row:last-child {
      border-bottom: none;
    }

    .data-table tbody tr.table-row:hover {
      background: var(--surface-overlay);
    }

    .data-table tbody tr.table-row.is-clickable { cursor: pointer; }

    .data-table tbody tr.table-row.is-selected {
      background: var(--accent-softer) !important;
      box-shadow: inset 3px 0 0 var(--accent-color);
    }

    .data-table tbody td {
      padding: var(--space-lg) var(--space-2xl);
      color: var(--text-primary);
      vertical-align: middle;
      white-space: nowrap;
    }

    .data-table tbody td.cell-name {
      white-space: normal;
      min-width: 200px;
    }

    .empty-cell { padding: var(--space-3xl) !important; }
    .empty-cell .empty-state {
      background: transparent;
      border: none;
      padding: 0;
    }
    .empty-cell .empty-state .mat-icon,
    .empty-cell .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }
    .empty-cell .empty-state p { font-size: 15px; }

    /* ── Mobile Cards ── */
    .mobile-grid {
      display: none;
      flex-direction: column;
      gap: var(--space-lg);
      padding-bottom: var(--space-2xl);
    }

    @media (max-width: 768px) {
      .mobile-grid { display: flex; }
    }

    .mobile-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
      box-shadow: var(--shadow-sm);
      transition: border-color var(--transition-base), box-shadow var(--transition-base);
    }

    .mobile-card.is-clickable { cursor: pointer; }
    .mobile-card.is-selected {
      border-color: var(--accent-color);
      box-shadow: var(--shadow-md);
    }

    .card-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .field-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: var(--space-sm);
      gap: var(--space-md);
    }

    .field-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .field-row .field-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .field-row .field-value {
      font-size: 14px;
      color: var(--text-primary);
      font-weight: 500;
      text-align: right;
      min-width: 0;
    }

    .card-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      border-top: 1px solid var(--border-color);
      padding-top: var(--space-md);
    }

    .card-actions ::ng-deep button {
      height: 36px !important;
      line-height: 36px !important;
      padding: 0 16px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      border-radius: var(--radius-sm) !important;
    }

    .mobile-empty { padding: var(--space-3xl) var(--space-lg); }

    .col-actions, .cell-actions { text-align: right !important; }
  `],
})
export class ResponsiveTableComponent<T extends Record<string, any>> {
  data = input<T[]>([]);
  displayedColumns = input<string[]>([]);
  columnLabels = input<Record<string, string>>({});
  rowClickable = input(false);
  selectedRowId = input<string | undefined>(undefined);

  rowActivate = output<T>();

  @ContentChildren(ColumnCellDirective) cells!: QueryList<ColumnCellDirective>;

  mobileDisplayedColumns = computed<string[]>(() => {
    return this.displayedColumns().filter((col) => col !== 'actions');
  });

  hasActionsColumn(): boolean {
    return this.displayedColumns().includes('actions');
  }

  getTemplate(columnName: string): TemplateRef<any> | null {
    const cell = this.cells?.find((c) => c.columnName() === columnName);
    return cell ? cell.templateRef : null;
  }

  onRowClick(row: T, event: Event) {
    if (!this.rowClickable()) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, mat-checkbox')) return;
    this.rowActivate.emit(row);
  }
}
