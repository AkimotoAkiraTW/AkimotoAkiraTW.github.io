import {
  Component,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { ToolLayoutComponent } from '../tool-layout.component';

// ─── 資料模型 ───────────────────────────────────────────────────────────────

interface ProductSetting {
  isBogo: boolean;
  isGift: boolean;
  bogoLimit: number | null;
}

interface OrderItem {
  storeName: string;
  buyer: string;
  itemName: string;
  quantity: number;
  price: number;
  /** 從 subtitle 解析出的加料/加大總費用 */
  customizationPrice: number;
  /** API 已計算的折扣（如買一送一的顯式折扣） */
  explicitDiscount: number;
  /** 計算後的應付金額 */
  finalPayable: number;
  /** 原始解析出的個人應付金額 (防累加變形用) */
  originalPayable: number;
  isBogo?: boolean;
  isGift?: boolean;
  unitBasePrice: number;
}

interface ParsedOrderSummary {
  uuid: string;
  storeName: string;
  status: string;
  jsonTotal: number;
}

type SplitMethod = 'proportional' | 'flat';

// ─── Component ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-uber-eats-settlement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
    ToolLayoutComponent,
  ],
  template: `
    <app-tool-layout 
      title="Uber Eats 團購對帳工具" 
      description="貼入訂單 JSON，自動計算各成員應付金額，支援公平折扣平攤與差價隔離。">
      
      <div class="tool-page-content">
        <!-- JSON 輸入面板 -->
        <mat-card appearance="outlined" class="input-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>upload_file</mat-icon>
            <mat-card-title>貼入訂單 JSON</mat-card-title>
            <mat-card-subtitle>
              從瀏覽器開發者工具 Network 頁籤找到 <code>getActiveOrdersV1</code> 請求，複製 Response 內容貼入。
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" class="full-width json-field">
              <mat-label>getActiveOrdersV1 Response JSON</mat-label>
              <textarea
                matInput
                [(ngModel)]="rawJson"
                rows="7"
                placeholder='{ "data": { "orders": [...] } }'
                spellcheck="false"
              ></textarea>
            </mat-form-field>

            @if (parseError()) {
              <div class="error-container">
                <div class="error-header">
                  <p class="error-hint">
                    <mat-icon inline>error_outline</mat-icon>
                    {{ parseError() }}
                  </p>
                  <span class="spacer"></span>
                  @if (canRepair()) {
                    <button mat-flat-button color="accent" size="small" (click)="repairJson()">
                      <mat-icon>magic_button</mat-icon> 修復雜質並解析
                    </button>
                  }
                </div>
                @if (parseErrorDetail()) {
                  <pre class="error-detail"><code>{{ parseErrorDetail() }}</code></pre>
                }
              </div>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-button (click)="clearAll()">
              <mat-icon>clear</mat-icon> 清除全部
            </button>
            <button mat-stroked-button (click)="parseJson(true)" [disabled]="!rawJson">
              <mat-icon>add</mat-icon> 累積解析
            </button>
            <button mat-raised-button color="primary" (click)="parseJson(false)" [disabled]="!rawJson">
              <mat-icon>auto_fix_high</mat-icon> 全新解析
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- 結果區塊 -->
        @if (orderItems().length > 0) {
          <!-- 店家資訊 & 狀態 -->
          <div class="store-header">
            <div class="header-actions">
              <div class="store-items">
                @for (order of parsedOrders(); track order.uuid) {
                  <div class="store-item">
                    <span class="store-name">{{ order.storeName }}</span>
                    @if (order.status) {
                      <mat-chip [disableRipple]="true">{{ order.status }}</mat-chip>
                    }
                  </div>
                }
              </div>
              
              <div class="view-toggle">
                <button mat-icon-button [color]="viewMode() === 'table' ? 'primary' : ''" (click)="viewMode.set('table')" matTooltip="表格模式">
                  <mat-icon>table_rows</mat-icon>
                </button>
                <button mat-icon-button [color]="viewMode() === 'card' ? 'primary' : ''" (click)="viewMode.set('card')" matTooltip="卡片模式">
                  <mat-icon>grid_view</mat-icon>
                </button>
              </div>
            </div>
          </div>

          <!-- 分攤設定 -->
          <mat-card appearance="outlined" class="config-card">
            <mat-card-content>
              <div class="config-row">
                <mat-form-field appearance="outline" class="config-field">
                  <mat-label>全單折扣 ($)</mat-label>
                  <input matInput type="number" [(ngModel)]="globalDiscount" (ngModelChange)="recalculate()" min="0">
                  <mat-icon matPrefix>local_offer</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="config-field">
                  <mat-label>運費 / 雜費 ($)</mat-label>
                  <input matInput type="number" [(ngModel)]="deliveryFee" (ngModelChange)="recalculate()" min="0">
                  <mat-icon matPrefix>delivery_dining</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="config-field">
                  <mat-label>分攤方式</mat-label>
                  <mat-select [(ngModel)]="splitMethod" (ngModelChange)="recalculate()">
                    <mat-option value="proportional">按金額比例</mat-option>
                    <mat-option value="flat">按人頭平攤</mat-option>
                  </mat-select>
                  <mat-icon matPrefix>calculate</mat-icon>
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>



          <!-- 數據統計 -->
          <div class="stats-row">
            <div class="stat-card accent">
              <span class="stat-label">Uber 實付總額</span>
              <span class="stat-value positive">{{ fmt(stats().jsonTotal) }}</span>
            </div>
            <div class="stat-card" [class.warn]="stats().discrepancy !== 0">
              <span class="stat-label" matTooltip="Uber 實付總額 - 當前對帳總和。差距不為零代表有未分配的折扣或費用">差距（未分配）</span>
              <span class="stat-value" [class.negative]="stats().discrepancy < 0" [class.positive-warn]="stats().discrepancy > 0">
                {{ fmt(stats().discrepancy) }}
              </span>
            </div>
            <div class="stat-card highlight">
              <span class="stat-label">當前對帳總和</span>
              <span class="stat-value primary">{{ fmt(stats().checkSum) }}</span>
            </div>
          </div>

          <!-- 餘額警告 + 智慧平攤 -->
          @if (showBalanceWarning()) {
            <div class="balance-warning">
              <mat-icon>warning_amber</mat-icon>
              <span>
                對帳總和 ({{ fmt(stats().checkSum) }}) 與 Uber 實付 ({{ fmt(stats().jsonTotal) }}) 差了
                <strong>{{ fmt(Math.abs(stats().discrepancy)) }}</strong>，
                @if (stats().discrepancy < 0) { 可能有未輸入的折扣（例如平台買一送一）。 }
                @else { 可能有未輸入的運費或服務費。 }
              </span>
              <button mat-stroked-button class="smart-btn" (click)="smartDistribute()"
                matTooltip="將差距金額直接加入全單折扣/運費，使對帳總和與 Uber 實付吻合">
                <mat-icon>auto_fix_high</mat-icon> 智慧平攤
              </button>
            </div>
          }

          <!-- 訂單明細表 -->
          @if (viewMode() === 'table') {
            <mat-card appearance="outlined" class="table-card">
              <mat-card-content>
                <div class="table-wrapper">
                  <table class="order-table">
                    <thead>
                      <tr>
                        <th>店家/訂購人</th>
                        <th>品項</th>
                        <th class="center">數量</th>
                        <th class="right">原價</th>
                        <th class="right">加項費</th>

                        <th class="right">應付金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of orderItems(); track $index) {
                        <tr>
                          <td class="buyer-cell">
                            <div class="store-tag" [matTooltip]="item.storeName">{{ item.storeName }}</div>
                            {{ item.buyer }}
                          </td>
                          <td>
                            <div class="item-name-group">
                              <div class="title-row">
                                <span class="item-title">{{ item.itemName }}</span>
                                @if (productSettings()[item.itemName]?.isBogo) {
                                  <span class="badge badge-bogo">買一送一 BOGO</span>
                                }
                                @if (productSettings()[item.itemName]?.isGift) {
                                  <span class="badge badge-gift">贈品 GIFT</span>
                                }
                                @if (item.explicitDiscount > 0) {
                                  <span class="discount-chip"
                                    matTooltip="Uber 系統在此品項上已套用折扣（如買一送一、百分比折扣），應付金額已反映此折扣">
                                    已扣 {{ fmt(item.explicitDiscount) }}
                                  </span>
                                }
                              </div>
                              <div class="product-toggles">
                                <span class="toggle-label">覆寫屬性:</span>
                                <button 
                                  type="button"
                                  class="badge-toggle-btn bogo-toggle"
                                  [class.active]="productSettings()[item.itemName]?.isBogo"
                                  (click)="toggleProductSetting(item.itemName, 'isBogo')"
                                  matTooltip="手動設定此品項為買一送一 (BOGO)，折扣將由所有購買者公平分攤底價">
                                  <mat-icon class="toggle-icon">local_offer</mat-icon> 買一送一
                                </button>
                                <button 
                                  type="button"
                                  class="badge-toggle-btn gift-toggle"
                                  [class.active]="productSettings()[item.itemName]?.isGift"
                                  (click)="toggleProductSetting(item.itemName, 'isGift')"
                                  matTooltip="手動設定此品項為滿額贈品 (GIFT)，原價/底價全免，僅需支付加項費">
                                  <mat-icon class="toggle-icon">redeem</mat-icon> 贈品
                                </button>

                                @if (productSettings()[item.itemName]?.isBogo) {
                                  <div class="limit-wrapper">
                                    <span class="limit-label">限額:</span>
                                    <input 
                                      type="number" 
                                      class="limit-input"
                                      placeholder="無上限"
                                      [ngModel]="productSettings()[item.itemName]?.bogoLimit"
                                      (ngModelChange)="updateBogoLimit(item.itemName, $event)"
                                      min="1"
                                      matTooltip="買一送一最大免費杯數（例如：上限10組請輸入10）"
                                    />
                                    <span class="limit-unit">組</span>
                                  </div>
                                }
                              </div>
                            </div>
                          </td>
                          <td class="center">{{ item.quantity }}</td>
                          <td class="right">{{ fmt(item.price) }}</td>
                          <td class="right customization-cell">
                            <input
                              type="number"
                              class="inline-input"
                              [(ngModel)]="item.customizationPrice"
                              (ngModelChange)="recalculate()"
                              min="0"
                            />
                          </td>

                          <td class="right payable">
                            {{ fmt(item.finalPayable) }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </mat-card-content>
              <mat-divider></mat-divider>
              <mat-card-actions align="end">
                <button mat-stroked-button (click)="exportCsv()">
                  <mat-icon>download</mat-icon> 匯出 CSV
                </button>
              </mat-card-actions>
            </mat-card>
 
            <!-- 每人小計 -->
            <mat-card appearance="outlined" class="summary-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>people</mat-icon>
                <mat-card-title>每人應付小計</mat-card-title>
                <mat-card-subtitle>各成員在本次訂單中的應付總金額</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="summary-grid">
                  @for (entry of buyerSummary(); track entry.buyer) {
                    <div class="summary-item">
                      <div class="summary-buyer">
                        <span class="summary-store">{{ entry.storeName }}</span>
                        <span class="summary-name">{{ entry.buyer }}</span>
                      </div>
                      <div class="summary-right">
                        <span class="summary-items">{{ entry.itemCount }} 件</span>
                        <span class="summary-amount">{{ fmt(entry.total) }}</span>
                      </div>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          } @else {
            <!-- 卡片模式 -->
            <div class="card-grid">
              @for (item of orderItems(); track $index) {
                <mat-card appearance="outlined" class="item-card">
                  <div class="item-card-header">
                    <div class="item-card-buyer">
                      <span class="store-tag" [matTooltip]="item.storeName">{{ item.storeName }}</span>
                      {{ item.buyer }}
                    </div>
                    <div class="item-card-payable">{{ fmt(item.finalPayable) }}</div>
                  </div>
                  <div class="item-card-content">
                    <div class="item-card-title">
                      <div class="title-row">
                        <span class="item-title">{{ item.itemName }}</span>
                        @if (productSettings()[item.itemName]?.isBogo) {
                          <span class="badge badge-bogo">買一送一 BOGO</span>
                        }
                        @if (productSettings()[item.itemName]?.isGift) {
                          <span class="badge badge-gift">贈品 GIFT</span>
                        }
                        @if (item.explicitDiscount > 0) {
                          <span class="discount-chip">已扣 {{ fmt(item.explicitDiscount) }}</span>
                        }
                      </div>
                      <div class="product-toggles card-toggles">
                        <button 
                          type="button"
                          class="badge-toggle-btn bogo-toggle"
                          [class.active]="productSettings()[item.itemName]?.isBogo"
                          (click)="toggleProductSetting(item.itemName, 'isBogo')"
                          matTooltip="手動設定此品項為買一送一 (BOGO)">
                          <mat-icon class="toggle-icon">local_offer</mat-icon> BOGO
                        </button>
                        <button 
                          type="button"
                          class="badge-toggle-btn gift-toggle"
                          [class.active]="productSettings()[item.itemName]?.isGift"
                          (click)="toggleProductSetting(item.itemName, 'isGift')"
                          matTooltip="手動設定此品項為滿額贈品 (GIFT)">
                          <mat-icon class="toggle-icon">redeem</mat-icon> 贈品
                        </button>

                        @if (productSettings()[item.itemName]?.isBogo) {
                          <div class="limit-wrapper">
                            <span class="limit-label">限額:</span>
                            <input 
                              type="number" 
                              class="limit-input"
                              placeholder="無上限"
                              [ngModel]="productSettings()[item.itemName]?.bogoLimit"
                              (ngModelChange)="updateBogoLimit(item.itemName, $event)"
                              min="1"
                              matTooltip="買一送一最大免費杯數（例如：上限10組請輸入10）"
                            />
                            <span class="limit-unit">組</span>
                          </div>
                        }
                      </div>
                    </div>
                    <div class="item-card-details">
                      <span>數量: {{ item.quantity }}</span>
                      <span>原價: {{ fmt(item.price) }}</span>
                    </div>
                    <div class="item-card-actions">
                      <div>
                        <span class="card-input-label">加項費 ($)</span>
                        <input
                          type="number"
                          class="inline-input"
                          style="width: 80px;"
                          [(ngModel)]="item.customizationPrice"
                          (ngModelChange)="recalculate()"
                          min="0"
                        />
                      </div>

                    </div>
                  </div>
                </mat-card>
              }
            </div>
            <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
              <button mat-raised-button color="primary" (click)="exportCsv()">
                <mat-icon>download</mat-icon> 匯出 CSV
              </button>
            </div>
          }
        }
      </div>
    </app-tool-layout>
  `,
  styles: [`
    .tool-page-content { padding-bottom: 60px; }
    code { font-family: 'Roboto Mono', monospace; background: color-mix(in srgb, currentColor 8%, transparent); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
    .input-card { margin-bottom: 24px; border-color: color-mix(in srgb, var(--mat-sys-primary, #1976d2) 20%, transparent); }
    .full-width { width: 100%; }
    .json-field { margin-top: 8px; }
    
    .error-container { 
      margin-top: 12px; padding: 12px; 
      background: color-mix(in srgb, var(--mat-sys-error) 5%, transparent); 
      border: 1px solid color-mix(in srgb, var(--mat-sys-error) 20%, transparent); 
      border-radius: 8px; 
    }
    .error-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .spacer { flex: 1; }
    .error-hint { color: var(--mat-sys-error); display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.95rem; margin: 0; }
    .error-detail { 
      background: #1e1e1e; color: #f87171; padding: 10px; border-radius: 6px; 
      font-family: 'Roboto Mono', monospace; font-size: 0.8rem; overflow-x: auto; 
      white-space: pre; line-height: 1.4; border: 1px solid #450a0a; 
    }
 
    .store-header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .header-actions { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
    .store-items { display: flex; flex-direction: column; gap: 8px; }
    .store-item { display: flex; align-items: center; gap: 12px; }
    .store-name { font-size: 1.25rem; font-weight: 700; color: color-mix(in srgb, currentColor 80%, transparent); }
    .config-card { margin-bottom: 20px; }
    .config-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; padding-top: 8px; }
    .config-field { flex: 1; min-width: 160px; }
    
    /* Stats Row & Cards Modern Glassmorphic Styling */
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .stat-card { 
      background: var(--surface-color); 
      border: 1px solid var(--border-color); 
      border-radius: 16px; 
      padding: 20px; 
      text-align: center; 
      box-shadow: var(--card-shadow);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 20px -8px rgb(0 0 0 / 0.12);
    }
    .stat-card.accent { 
      background: color-mix(in srgb, var(--accent-color) 4%, var(--surface-color)); 
      border-color: color-mix(in srgb, var(--accent-color) 20%, var(--border-color)); 
    }
    .stat-card.highlight { 
      background: color-mix(in srgb, var(--mat-sys-tertiary, #6750a4) 4%, var(--surface-color)); 
      border-color: color-mix(in srgb, var(--mat-sys-tertiary, #6750a4) 20%, var(--border-color)); 
    }
    .stat-card.warn { 
      background: color-mix(in srgb, #eab308 4%, var(--surface-color)); 
      border-color: color-mix(in srgb, #eab308 20%, var(--border-color)); 
    }
    .stat-label { display: block; font-size: 0.75rem; opacity: 0.6; margin-bottom: 6px; cursor: default; }
    .stat-value { font-size: 1.45rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .stat-value.positive { color: #10b981; }
    .stat-value.positive-warn { color: #d97706; }
    .stat-value.negative { color: var(--mat-sys-error, #ef4444); }
    .stat-value.primary { color: var(--accent-color); }
    
    /* Balance Warning Premium Adaptive Palette */
    .balance-warning { 
      display: flex; 
      align-items: center; 
      gap: 12px; 
      flex-wrap: wrap; 
      background: #fffbeb; 
      border: 1px solid #fde68a; 
      color: #b45309; 
      border-radius: 12px; 
      padding: 14px 20px; 
      font-size: 0.875rem; 
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(245, 158, 11, 0.03);
    }
    :host-context(html.dark-theme) .balance-warning {
      background: rgba(245, 158, 11, 0.08);
      border-color: rgba(245, 158, 11, 0.2);
      color: #fef08a;
    }
    .balance-warning span { flex: 1; min-width: 200px; }
    .smart-btn { 
      white-space: nowrap; 
      color: #b45309 !important; 
      border-color: #fde68a !important; 
      background: transparent !important;
    }
    :host-context(html.dark-theme) .smart-btn {
      color: #fef08a !important;
      border-color: rgba(245, 158, 11, 0.3) !important;
    }
    
    .summary-card { margin-top: 20px; }
    .summary-grid { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
    .summary-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 8px; transition: background 0.15s; }
    .summary-item:hover { background: var(--surface-alt); }
    .summary-buyer { display: flex; flex-direction: column; gap: 2px; }
    .summary-store { font-size: 0.65rem; opacity: 0.45; }
    .summary-name { font-weight: 600; font-size: 0.95rem; }
    .summary-right { display: flex; align-items: center; gap: 16px; }
    .summary-items { font-size: 0.8rem; opacity: 0.5; }
    .summary-amount { font-size: 1.15rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--accent-color); min-width: 80px; text-align: right; }
    
    .table-card { margin-bottom: 24px; }
    .table-wrapper { overflow-x: auto; margin: 0 -16px; padding: 0 16px; }
    
    /* Elegant Clean Table Styles */
    .order-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 600px; }
    .order-table th { 
      font-size: 0.75rem; 
      font-weight: 600; 
      text-transform: uppercase; 
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      border-bottom: 2px solid var(--border-color);
      padding: 14px 16px;
      opacity: 0.8;
    }
    .order-table td { 
      padding: 16px; 
      border-bottom: 1px solid var(--border-color); 
      color: var(--text-primary);
      vertical-align: middle;
    }
    .center { text-align: center; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    .buyer-cell { font-weight: 600; }
    
    /* Truncated & Hover-Tooltip Store Tag */
    .store-tag { 
      font-size: 0.65rem; 
      opacity: 0.6; 
      font-weight: 500;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 2px;
      display: block;
      cursor: help;
    }
    
    /* Premium Inline Inputs */
    .inline-input { 
      width: 72px; 
      background: var(--surface-alt); 
      border: 1px solid var(--border-color); 
      color: var(--text-primary); 
      border-radius: 8px; 
      padding: 4px 8px; 
      text-align: right; 
      outline: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: 'Roboto Mono', monospace;
      font-variant-numeric: tabular-nums;
      font-size: 0.875rem;
    }
    .inline-input:hover {
      background: color-mix(in srgb, var(--surface-alt) 85%, var(--text-muted));
      border-color: color-mix(in srgb, var(--border-color) 70%, var(--text-muted));
    }
    .inline-input:focus {
      background: var(--surface-color);
      border-color: var(--accent-color);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color) 15%, transparent);
    }
    .inline-input::-webkit-outer-spin-button,
    .inline-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .inline-input[type="number"] {
      -moz-appearance: textfield;
    }
    
    /* Premium Soft Amber Discount Chip */
    .discount-chip { 
      display: inline-block; 
      background: #fef3c7; 
      color: #b45309; 
      border: 1px solid #fde68a;
      font-size: 0.72rem; 
      padding: 1.5px 8px; 
      border-radius: 999px; 
      margin-left: 6px; 
      vertical-align: middle;
      font-weight: 600;
    }
    :host-context(html.dark-theme) .discount-chip {
      background: rgba(245, 158, 11, 0.15); 
      color: #fbbf24; 
      border-color: rgba(245, 158, 11, 0.3);
    }
    
    .payable { font-weight: 700; color: var(--accent-color); font-size: 0.95rem; }
    .item-name-group { display: flex; flex-direction: column; gap: 2px; }
    .item-title { font-weight: 500; }
    .help-icon { font-size: 0.85em; opacity: 0.5; vertical-align: middle; }
 
    /* 卡片模式樣式 */
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
    .item-card { border-radius: 12px; transition: transform 0.2s; border: 1px solid var(--border-color); }
    .item-card:hover { transform: translateY(-2px); }
    .item-card-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 16px; border-bottom: 1px solid var(--border-color); }
    .item-card-buyer { display: flex; flex-direction: column; font-weight: 600; }
    .item-card-payable { font-size: 1.2rem; font-weight: 800; color: var(--accent-color); }
    .item-card-content { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
    .item-card-title { font-weight: 500; font-size: 1.05rem; }
    .item-card-details { display: flex; gap: 12px; font-size: 0.85rem; opacity: 0.7; }
    .item-card-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--border-color); }
    .card-input-label { font-size: 0.75rem; opacity: 0.6; margin-bottom: 4px; display: block; }

    /* 買一送一與贈品徽章及切換樣式 */
    .title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
    
    .badge { 
      display: inline-flex; 
      align-items: center; 
      font-size: 0.7rem; 
      font-weight: 700; 
      padding: 2.5px 8px; 
      border-radius: 6px; 
      text-transform: uppercase; 
      letter-spacing: 0.05em; 
    }
    .badge-bogo { 
      background: #e6f4ea; 
      color: #137333; 
      border: 1px solid rgba(16, 185, 129, 0.2); 
    }
    :host-context(html.dark-theme) .badge-bogo {
      background: rgba(16, 185, 129, 0.15); 
      color: #34d399; 
      border-color: rgba(16, 185, 129, 0.3);
    }
    .badge-gift { 
      background: #f3e8fd; 
      color: #7627d3; 
      border: 1px solid rgba(139, 92, 246, 0.2); 
    }
    :host-context(html.dark-theme) .badge-gift {
      background: rgba(139, 92, 246, 0.15); 
      color: #a78bfa; 
      border-color: rgba(139, 92, 246, 0.3);
    }
    
    /* Flex Container & Prevention of Toggle Wrapping */
    .product-toggles { 
      display: flex; 
      align-items: center; 
      gap: 6px 10px; 
      margin-top: 6px; 
      font-size: 0.75rem; 
      color: var(--text-secondary);
      flex-wrap: wrap;
    }
    .toggle-label { font-weight: 500; font-size: 0.72rem; }
    .badge-toggle-btn { 
      display: inline-flex; 
      align-items: center; 
      gap: 4px; 
      font-size: 0.72rem; 
      font-weight: 600; 
      padding: 3.5px 10px; 
      border-radius: 6px; 
      border: 1px solid var(--border-color); 
      background: var(--surface-color); 
      color: var(--text-secondary); 
      cursor: pointer; 
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      white-space: nowrap;
    }
    .badge-toggle-btn:hover { 
      background: var(--surface-alt); 
      border-color: color-mix(in srgb, var(--text-muted) 50%, transparent);
      color: var(--text-primary);
    }
    .badge-toggle-btn .toggle-icon { font-size: 14px; width: 14px; height: 14px; min-width: 14px; min-height: 14px; display: inline-block; vertical-align: middle; }
    
    /* 啟動狀態的 BOGO 按鈕 - 高對比度、主題自適應 */
    .badge-toggle-btn.bogo-toggle.active { 
      background: #e6f4ea; 
      color: #059669; 
      border-color: rgba(16, 185, 129, 0.3); 
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.08);
    }
    .badge-toggle-btn.bogo-toggle.active:hover {
      background: #d1fae5;
    }
    :host-context(html.dark-theme) .badge-toggle-btn.bogo-toggle.active { 
      background: rgba(16, 185, 129, 0.2); 
      color: #34d399; 
      border-color: rgba(16, 185, 129, 0.4); 
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
    }
    :host-context(html.dark-theme) .badge-toggle-btn.bogo-toggle.active:hover {
      background: rgba(16, 185, 129, 0.28);
    }
    
    /* 啟動狀態的 GIFT 按鈕 - 高對比度、主題自適應 */
    .badge-toggle-btn.gift-toggle.active { 
      background: #f3e8fd; 
      color: #7c3aed; 
      border-color: rgba(139, 92, 246, 0.3); 
      box-shadow: 0 0 8px rgba(139, 92, 246, 0.08);
    }
    .badge-toggle-btn.gift-toggle.active:hover {
      background: #ede9fe;
    }
    :host-context(html.dark-theme) .badge-toggle-btn.gift-toggle.active { 
      background: rgba(139, 92, 246, 0.2); 
      color: #a78bfa; 
      border-color: rgba(139, 92, 246, 0.4); 
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.2);
    }
    :host-context(html.dark-theme) .badge-toggle-btn.gift-toggle.active:hover {
      background: rgba(139, 92, 246, 0.28);
    }

    .card-toggles { margin-top: 8px; justify-content: flex-start; }
    .limit-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--surface-alt);
      padding: 3.5px 10px;
      border-radius: 6px;
      border: 1px dashed var(--border-color);
      margin-left: 0;
      vertical-align: middle;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .limit-wrapper:hover {
      background: color-mix(in srgb, var(--surface-alt) 80%, var(--text-muted));
      border-color: color-mix(in srgb, var(--border-color) 70%, var(--text-muted));
    }
    .limit-label {
      font-size: 0.72rem;
      opacity: 0.8;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .limit-input {
      width: 36px;
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
      font-size: 0.8rem;
      text-align: center;
      outline: none;
      padding: 0 2px;
      font-weight: 700;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: 'Roboto Mono', monospace;
    }
    .limit-input:hover {
      border-bottom-color: color-mix(in srgb, var(--border-color) 50%, var(--text-muted));
    }
    .limit-input:focus {
      border-bottom-color: var(--accent-color);
      border-bottom-width: 2px;
      padding-bottom: 0px; 
    }
    .limit-input::-webkit-outer-spin-button,
    .limit-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .limit-input[type="number"] {
      -moz-appearance: textfield;
    }
    .limit-unit {
      font-size: 0.72rem;
      opacity: 0.8;
      font-weight: 600;
      color: var(--text-secondary);
    }
  `],
})
export class UberEatsSettlementComponent {
  private snackBar = inject(MatSnackBar);

  rawJson = '';
  parseError = signal('');
  parseErrorDetail = signal('');
  canRepair = signal(false);
  parsedOrders = signal<ParsedOrderSummary[]>([]);
  orderItems = signal<OrderItem[]>([]);
  viewMode = signal<'table' | 'card'>('table');
  productSettings = signal<Record<string, ProductSetting>>({});

  readonly _jsonTotal = computed(() => {
    return this.parsedOrders().reduce((sum, o) => sum + o.jsonTotal, 0);
  });

  globalDiscount = 0;
  deliveryFee = 0;
  splitMethod: SplitMethod = 'proportional';

  readonly stats = computed(() => {
    const items = this.orderItems();
    const jsonTotal = this._jsonTotal();
    let checkSum = 0;
    items.forEach(i => { checkSum += i.finalPayable; });
    // discrepancy = Uber 實付 - 我們的對帳總和
    // 正數：我們算少了（可能有未分配的費用）
    // 負數：我們算多了（可能有未輸入的折扣）
    return { jsonTotal, discrepancy: jsonTotal - checkSum, checkSum };
  });

  readonly buyerSummary = computed(() => {
    const map = new Map<string, { buyer: string, storeName: string, total: number, itemCount: number }>();
    this.orderItems().forEach(item => {
      const key = `${item.storeName}|${item.buyer}`;
      const existing = map.get(key);
      if (existing) {
        existing.total += item.finalPayable;
        existing.itemCount += item.quantity;
      } else {
        map.set(key, { buyer: item.buyer, storeName: item.storeName, total: item.finalPayable, itemCount: item.quantity });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  });

  readonly showBalanceWarning = computed(
    () => Math.abs(this.stats().discrepancy) > 0.5 && this.orderItems().length > 0
  );

  readonly Math = Math;

  parseJson(append = false): void {
    this.parseError.set('');
    this.parseErrorDetail.set('');
    this.canRepair.set(false);
    
    if (!this.rawJson.trim()) return;

    // 預先偵測雜質
    if (/[\u00A0\u0000-\u001F\u007F-\u009F]/.test(this.rawJson)) {
      this.canRepair.set(true);
    }

    try {
      const data = JSON.parse(this.rawJson);
      this.processData(data, append);
      this.rawJson = '';
    } catch (e) {
      const err = e as Error;
      this.parseError.set('JSON 格式錯誤，可能包含隱形雜質。');
      
      // 擷取錯誤片段 (使用剛剛在 Formatter 驗證過的邏輯)
      const posMatch = err.message.match(/at position (\d+)/);
      const lcMatch = err.message.match(/at line (\d+) column (\d+)/);
      let pos = -1;
      if (posMatch) pos = parseInt(posMatch[1], 10);
      else if (lcMatch) pos = this.getPosFromLineCol(this.rawJson, parseInt(lcMatch[1], 10), parseInt(lcMatch[2], 10));

      if (pos >= 0) {
        this.parseErrorDetail.set(this.generateErrorSnippet(this.rawJson, pos, err.message));
      } else {
        this.parseErrorDetail.set(err.message);
      }
    }
  }

  repairJson(): void {
    const cleaned = this.rawJson
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/\u00A0/g, " ");
    this.rawJson = cleaned;
    this.parseJson(false);
    this.snackBar.open('已自動修復雜質並重新解析', '確定', { duration: 2000 });
  }

  private getPosFromLineCol(text: string, line: number, col: number): number {
    const lines = text.split('\n');
    let pos = 0;
    for (let i = 0; i < line - 1; i++) pos += lines[i].length + 1;
    return pos + col - 1;
  }

  private generateErrorSnippet(json: string, pos: number, message: string): string {
    const start = Math.max(0, pos - 20);
    const end = Math.min(json.length, pos + 20);
    const visualize = (str: string) => str.replace(/\n/g, '↵').replace(/\u00A0/g, '[NBSP]');
    const snippet = visualize(json.substring(start, end));
    const prefix = visualize(json.substring(start, pos));
    return `${snippet}\n${' '.repeat(prefix.length)}^`;
  }

  private processData(jsonData: unknown, append: boolean): void {
    try {
      const data = jsonData as Record<string, unknown>;
      const orders = (data['data'] as Record<string, unknown>)?.['orders'] as unknown[];
      
      if (!orders || !Array.isArray(orders)) {
        throw new Error('找不到 orders 資料');
      }

      const allNewOrderSummaries: ParsedOrderSummary[] = [];
      const allNewItems: OrderItem[] = [];

      orders.forEach((orderData, idx) => {
        const order = orderData as Record<string, unknown>;
        const orderUUID = order['uuid'] as string || `uuid-${Date.now()}-${idx}`;
        
        // 避免重複載入同一張訂單
        if (this.parsedOrders().some(o => o.uuid === orderUUID)) return;

        const feedCards = (order['feedCards'] as Array<Record<string, unknown>>) || [];
        const summaryCard = feedCards.find(c => c['orderSummary']) as Record<string, unknown> | undefined;
        if (!summaryCard) return;

        const analytics = order['analytics'] as Record<string, unknown>;
        const analyticsData = (analytics?.['data'] as Record<string, unknown>) || {};
        const jsonTotal = parseFloat(analyticsData['order_total'] as string) || 0;

        const orderInfo = (order['orderInfo'] as Record<string, unknown>) || {};
        const storeInfo = (orderInfo['storeInfo'] as Record<string, unknown>) || {};
        let storeName = (storeInfo['name'] as string) || '未知店家';
        
        const activeOrderOverview = order['activeOrderOverview'] as Record<string, unknown> | undefined;
        const tertiaryInfo = activeOrderOverview?.['tertiaryInfo'] as Record<string, unknown> | undefined;
        const groupOrderName = tertiaryInfo?.['title'] as string | undefined;
        if (groupOrderName) storeName += ` [${groupOrderName}]`;

        const activeStatus = order['activeOrderStatus'] as Record<string, unknown> | undefined;
        const subtitleSummary = activeStatus?.['subtitleSummary'] as Record<string, unknown> | undefined;
        const summary = subtitleSummary?.['summary'] as any;
        let status = typeof summary === 'string' ? summary : (summary?.['text'] || '');
        // 移除 HTML 標籤
        status = status.replace(/<[^>]*>/g, '').trim();

        const orderSummary = summaryCard['orderSummary'] as Record<string, unknown>;
        const parsed = this.parseSections(orderSummary['sections'] as Array<Record<string, unknown>>, storeName);
        
        allNewOrderSummaries.push({ uuid: orderUUID, storeName, status, jsonTotal });
        allNewItems.push(...parsed);
      });

      if (append) {
        this.parsedOrders.set([...this.parsedOrders(), ...allNewOrderSummaries]);
        const mergedItems = [...this.orderItems(), ...allNewItems];
        this.performAutoDetection(mergedItems);
        this.orderItems.set(mergedItems);
      } else {
        this.parsedOrders.set(allNewOrderSummaries);
        this.performAutoDetection(allNewItems);
        this.orderItems.set(allNewItems);
      }
      this.recalculate();
    } catch (err) {
      console.error('Data Processing Error:', err);
      this.parseError.set('解析訂單內容時發生錯誤，請確認 JSON 結構符合預期。');
    }
  }

  private parseSections(sections: Array<Record<string, unknown>>, storeName: string): OrderItem[] {
    const results: OrderItem[] = [];
    if (!sections) return results;

    sections.forEach(section => {
      const header = (section['header'] as Record<string, unknown>) || {};
      const buyer = (header['title'] as string) || '未知參與者';
      const items = (section['items'] as Array<Record<string, unknown>>) || [];
      
      items.forEach(item => {
        // 1. 原始標價
        const rawPriceStr = (item['price'] as string) || '$0';
        const originalPrice = parseFloat(rawPriceStr.replace(/[^\d.]/g, '')) || 0;
        
        // 2. 從 subtitle 提取加料金額
        const subtitle = (item['subtitle'] as string) || '';
        let unitCustomization = 0;
        const customMatches = subtitle.match(/\(\$(\d+\.?\d*)\)/g);
        if (customMatches) {
          customMatches.forEach(m => {
            unitCustomization += parseFloat(m.replace(/[^\d.]/g, '')) || 0;
          });
        }

        const quantity = (item['quantity'] as number) || 1;
        const totalCustomizationPrice = unitCustomization * quantity;
        const totalBasePrice = originalPrice - totalCustomizationPrice;
        const unitBasePrice = quantity > 0 ? totalBasePrice / quantity : 0;

        // 3. 折扣判斷
        const discountObj = item['itemDiscount'] as Record<string, unknown> | undefined;
        let finalPayablePrice = originalPrice;
        let explicitDiscount = 0;

        if (discountObj) {
          const discountVal = parseFloat(((discountObj['formattedAmount'] as string) || '0').replace(/[^\d.]/g, ''));
          
          // 語意判斷：
          // Uber 的 itemDiscount 在兩種情境下含義不同：
          // A) 「最終應付金額」：適用於 8折、滿額送等（如 $120→$96, $80→$10）
          // B) 「折扣金額」：適用於買一送一等（如 $110-$60=$50/2杯）
          //
          // 判斷依據：如果 (原價 - discountVal) 的每杯均價 < $5，
          // 代表用「折扣金額」算出來不合理，改用「最終應付金額」。
          const priceAfterDiscount = originalPrice - discountVal;
          const perUnitAfterDiscount = priceAfterDiscount / quantity;

          if (perUnitAfterDiscount < 5 || priceAfterDiscount < 0) {
            // 語意 A：discountVal 是「最終應付金額」
            finalPayablePrice = discountVal;
            explicitDiscount = originalPrice - discountVal;
          } else {
            // 語意 B：discountVal 是「折扣金額」，最終應付 = 原價 - 折扣
            finalPayablePrice = priceAfterDiscount;
            explicitDiscount = discountVal;
          }
        }

        results.push({
          storeName, buyer,
          itemName: (item['title'] as string) || '未名品項',
          quantity: quantity,
          price: originalPrice,
          customizationPrice: totalCustomizationPrice,
          explicitDiscount,
          finalPayable: finalPayablePrice,
          originalPayable: finalPayablePrice,
          unitBasePrice: unitBasePrice
        });
      });
    });
    return results;
  }

  performAutoDetection(items: OrderItem[]): void {
    const titleGroups: Record<string, {
      totalQty: number;
      hasDiscountRow: boolean;
      maxDiscountRatio: number;
      maxQty: number;
      maxPrice: number;
      customizationPrice: number;
      hasGiftKeyword: boolean;
      minImpliedPayable: number;
    }> = {};
    
    items.forEach(item => {
      const title = item.itemName;
      const isGiftKeyword = /送|贈|gift|free/i.test(title);
      
      if (!titleGroups[title]) {
        titleGroups[title] = {
          totalQty: 0,
          hasDiscountRow: false,
          maxDiscountRatio: 0,
          maxQty: 0,
          maxPrice: 0,
          customizationPrice: 0,
          hasGiftKeyword: isGiftKeyword,
          minImpliedPayable: 999999
        };
      }
      
      const group = titleGroups[title];
      group.totalQty += item.quantity;
      if (item.quantity > group.maxQty) {
        group.maxQty = item.quantity;
      }
      if (item.price > group.maxPrice) {
        group.maxPrice = item.price;
        group.customizationPrice = item.customizationPrice;
      }
      if (item.explicitDiscount > 0) {
        group.hasDiscountRow = true;
        const ratio = item.explicitDiscount / item.price;
        if (ratio > group.maxDiscountRatio) {
          group.maxDiscountRatio = ratio;
        }
      }
      
      const impliedPayable = item.price - item.explicitDiscount;
      if (impliedPayable < group.minImpliedPayable) {
        group.minImpliedPayable = impliedPayable;
      }
    });

    const settings = { ...this.productSettings() };

    Object.keys(titleGroups).forEach(title => {
      const g = titleGroups[title];
      
      if (settings[title]) return;

      let isGift = false;
      let isBogo = false;

      const isExplicitBaseFree = g.maxQty === 1 && g.hasDiscountRow && Math.abs(g.maxPrice - g.customizationPrice - g.maxDiscountRatio * g.maxPrice) < 0.01;
      const isCheapImpliedGift = g.maxQty === 1 && g.hasDiscountRow && g.minImpliedPayable < 15;
      
      if (g.hasGiftKeyword || isExplicitBaseFree || isCheapImpliedGift) {
        isGift = true;
      }

      if (!isGift && g.totalQty >= 2 && g.hasDiscountRow && g.maxDiscountRatio >= 0.4) {
        isBogo = true;
      }

      settings[title] = { isBogo, isGift, bogoLimit: null };
    });

    this.productSettings.set(settings);
  }

  toggleProductSetting(itemName: string, field: 'isBogo' | 'isGift'): void {
    const settings = { ...this.productSettings() };
    const current = settings[itemName] || { isBogo: false, isGift: false, bogoLimit: null };
    if (field === 'isBogo') {
      settings[itemName] = { isBogo: !current.isBogo, isGift: false, bogoLimit: current.bogoLimit };
    } else {
      settings[itemName] = { isBogo: false, isGift: !current.isGift, bogoLimit: null };
    }
    this.productSettings.set(settings);
    this.recalculate();
  }

  updateBogoLimit(itemName: string, limit: any): void {
    const settings = { ...this.productSettings() };
    if (settings[itemName]) {
      settings[itemName].bogoLimit = limit !== '' && limit !== null ? Math.max(1, Number(limit) || 1) : null;
      this.productSettings.set(settings);
      this.recalculate();
    }
  }

  recalculate(): void {
    const items = this.orderItems();
    if (items.length === 0) return;

    // 強制轉型與防禦
    this.globalDiscount = Math.max(0, Number(this.globalDiscount) || 0);
    this.deliveryFee = Math.max(0, Number(this.deliveryFee) || 0);

    const fee = this.deliveryFee;
    const discount = this.globalDiscount;

    // 依自定義加價更新單杯底價與原始應付
    items.forEach(item => {
      const qty = item.quantity || 1;
      const custom = Math.max(0, Number(item.customizationPrice) || 0);
      item.customizationPrice = custom;
      item.price = item.unitBasePrice * qty + custom;
      item.originalPayable = Math.max(0, (item.unitBasePrice * qty - item.explicitDiscount) + custom);
    });

    // 按品項分組統計數量與最高底價，用於計算 BOGO
    const titleGroups: Record<string, {
      items: OrderItem[];
      totalQty: number;
      maxUnitBase: number;
    }> = {};

    items.forEach(item => {
      const title = item.itemName;
      if (!titleGroups[title]) {
        titleGroups[title] = { items: [], totalQty: 0, maxUnitBase: item.unitBasePrice };
      }
      const g = titleGroups[title];
      g.items.push(item);
      g.totalQty += item.quantity;
      if (item.unitBasePrice > g.maxUnitBase) {
        g.maxUnitBase = item.unitBasePrice;
      }
    });

    let globalBasePoolTotal = 0;

    // 第一階段：計算 BOGO（含上限）與 Gift 折扣
    const phase1Items = items.map(item => {
      let itemBase = 0;
      const setting = this.productSettings()[item.itemName] || { isBogo: false, isGift: false, bogoLimit: null };

      if (setting.isBogo) {
        const g = titleGroups[item.itemName];
        const totalQty = g.totalQty;
        
        // 核心數學公式：免費杯數 = 總量的一半 (向下取整)，但不可超過設定之上限
        let freeCups = Math.floor(totalQty / 2);
        if (setting.bogoLimit !== null && setting.bogoLimit > 0) {
          freeCups = Math.min(setting.bogoLimit, freeCups);
        }
        
        const totalBogoDiscount = freeCups * g.maxUnitBase;
        const buyerDiscount = totalQty > 0 ? (item.quantity / totalQty) * totalBogoDiscount : 0;
        itemBase = item.price - buyerDiscount;
      } else if (setting.isGift) {
        itemBase = item.customizationPrice; // 贈品底價免除，僅付加料費
      } else {
        itemBase = item.originalPayable; // 一般品項
      }

      if (itemBase < 0) itemBase = 0;
      globalBasePoolTotal += itemBase;
      return { originalRef: item, computedItemBase: itemBase };
    });

    // 計算已被系統套用的特惠折扣總和
    const preAppliedDiscountsSum = phase1Items.reduce((sum, { originalRef, computedItemBase }) => {
      return sum + (originalRef.price - computedItemBase);
    }, 0);

    // 剩餘的全域折扣進行全域分攤
    const remainingGlobalDiscount = Math.max(0, discount - preAppliedDiscountsSum);
    const netAdjustment = fee - remainingGlobalDiscount;

    // 第二階段：分配全域淨調整額 (netAdjustment)
    const updated = phase1Items.map(({ originalRef, computedItemBase }) => {
      let share = 0;
      if (this.splitMethod === 'proportional' && globalBasePoolTotal > 0) {
        share = (computedItemBase / globalBasePoolTotal) * netAdjustment;
      } else if (this.splitMethod === 'flat') {
        share = netAdjustment / items.length;
      }

      return { ...originalRef, finalPayable: Math.max(0, computedItemBase + share) };
    });

    this.orderItems.set(updated);
  }

  /** 將差距直接加入全單折扣/運費，使對帳總和與 Uber 實付吻合 */
  smartDistribute(): void {
    const { discrepancy } = this.stats();
    if (discrepancy < 0) {
      // 我們算多了，需要增加全單折扣
      this.globalDiscount = Math.round((this.globalDiscount - discrepancy) * 100) / 100;
    } else {
      // 我們算少了，需要增加運費/雜費
      this.deliveryFee = Math.round((this.deliveryFee + discrepancy) * 100) / 100;
    }
    this.recalculate();
    this.snackBar.open('已自動平攤差距至' + (discrepancy < 0 ? '全單折扣' : '運費/雜費'), '', { duration: 2500 });
  }

  exportCsv(): void {
    const items = this.orderItems();
    const stats = this.stats();
    // 每人小計
    const summary = this.buyerSummary();
    let csv = '\uFEFF店家,訂購人,品項,數量,原價,加項,應付金額\n';
    items.forEach(item => {
      csv += `${item.storeName},${item.buyer},"${item.itemName}",${item.quantity},${item.price.toFixed(2)},${item.customizationPrice.toFixed(2)},${item.finalPayable.toFixed(2)}\n`;
    });
    csv += `\n對帳總和,,,,,,${stats.checkSum.toFixed(2)}\n`;
    csv += `Uber 實付,,,,,,${stats.jsonTotal.toFixed(2)}\n`;
    csv += `\n=== 每人小計 ===\n店家,姓名,件數,應付\n`;
    summary.forEach(s => {
      csv += `${s.storeName},${s.buyer},${s.itemCount},${s.total.toFixed(2)}\n`;
    });
    csv += `\n總計,,,${stats.checkSum.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'UberEats_Settlement.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.snackBar.open('CSV 已下載', '', { duration: 2000 });
  }

  clearAll(): void {
    this.rawJson = '';
    this.parseError.set('');
    this.parsedOrders.set([]);
    this.orderItems.set([]);
    this.globalDiscount = 0;
    this.deliveryFee = 0;
    this.splitMethod = 'proportional';
  }

  fmt(value: number): string {
    return '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
