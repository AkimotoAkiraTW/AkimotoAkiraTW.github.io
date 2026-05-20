import {
  Component, signal, computed, inject, ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToolLayoutComponent } from '../tool-layout.component';
import { TradevanParserService, TradevanRecord } from './tradevan-parser.service';

@Component({
  selector: 'app-tradevan-parser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatButtonModule, MatIconModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule,
    ToolLayoutComponent,
  ],
  template: `
<app-tool-layout
  title="關貿 CSV 解析工具"
  description="上傳電子發票加值中心下載的 CSV 檔，自動依法規計算 B2C 整期逆算稅額，一鍵產出法定申報期總表。">

  <div class="tool-content">

    <!-- 稅率設定 -->
    <mat-card appearance="outlined" class="rate-card">
      <mat-card-content>
        <div class="rate-row">
          <div class="rate-item">
            <label class="rate-label">
              <mat-icon inline>percent</mat-icon> 一般應稅稅率
            </label>
            <div class="rate-input-wrap">
              <input type="number" class="rate-input" [(ngModel)]="generalRatePct"
                     min="0" max="100" step="0.1">
              <span class="rate-unit">%</span>
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- 上傳區 -->
    <div class="drop-zone" [class.dragover]="isDragging()"
         (click)="fileInput.click()"
         (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
      <input #fileInput type="file" accept=".csv" multiple style="display:none"
             (change)="onFileChange($event)">
      <mat-icon class="drop-icon">table_chart</mat-icon>
      <div class="drop-title">拖曳或點選上傳關貿發票下載檔 (.CSV)</div>
      <div class="drop-sub">支援一次上傳多個 CSV 檔案 · 格式：發票號碼、發票日期、單位代碼...</div>
    </div>

    @if (allRows().length > 0) {

      <!-- 統計看板 -->
      <div class="stats-section">
        <div class="stat-group">
          <div class="stat-group-title">📄 發票張數</div>
          <div class="stat-grid">
            <div class="stat-card"><span class="stat-label">總張數</span><span class="stat-val accent">{{ stats().invTotal }}</span></div>
            <div class="stat-card"><span class="stat-label">正常</span><span class="stat-val green">{{ stats().invValid }}</span></div>
            <div class="stat-card"><span class="stat-label">作廢</span><span class="stat-val red">{{ stats().invVoid }}</span></div>
            <div class="stat-card"><span class="stat-label">自然人(B2C)</span><span class="stat-val green">{{ stats().invB2C }}</span></div>
            <div class="stat-card"><span class="stat-label">法人(B2B)</span><span class="stat-val yellow">{{ stats().invB2B }}</span></div>
          </div>
        </div>

        <div class="stat-group">
          <div class="stat-group-title">⚡ 應稅（{{ generalRatePct }}%）— 依施行細則第 32-1 條整期逆算</div>
          <div class="stat-grid">
            <div class="stat-card"><span class="stat-label">B2C 含稅總額</span><span class="stat-val">{{ fmt(stats().b2cGross) }}</span><span class="stat-sub">逆算來源</span></div>
            <div class="stat-card"><span class="stat-label">B2C 未稅銷售額</span><span class="stat-val green">{{ fmt(stats().b2cSalesAgg) }}</span></div>
            <div class="stat-card"><span class="stat-label">B2C 稅額</span><span class="stat-val red">{{ fmt(stats().b2cTaxAgg) }}</span></div>
            <div class="stat-card"><span class="stat-label">B2B 銷售額</span><span class="stat-val green">{{ fmt(stats().b2bSales) }}</span></div>
            <div class="stat-card"><span class="stat-label">B2B 稅額</span><span class="stat-val red">{{ fmt(stats().b2bTax) }}</span></div>
            <div class="stat-card accent-card"><span class="stat-label">★ 應稅含稅總額</span><span class="stat-val accent">{{ fmt(stats().taxGrossTotal) }}</span></div>
          </div>
        </div>

        <div class="stat-group">
          <div class="stat-group-title">🔵 零稅率 / ⬜ 免稅 / 📊 總計</div>
          <div class="stat-grid">
            <div class="stat-card"><span class="stat-label">零稅率銷售額</span><span class="stat-val green">{{ fmt(stats().zeroSales) }}</span></div>
            <div class="stat-card"><span class="stat-label">免稅銷售額</span><span class="stat-val green">{{ fmt(stats().exSales) }}</span></div>
            <div class="stat-card total-card"><span class="stat-label">★ 總銷售額（未稅）</span><span class="stat-val yellow">{{ fmt(stats().totalSales) }}</span></div>
            <div class="stat-card total-card"><span class="stat-label">★ 總稅額</span><span class="stat-val red">{{ fmt(stats().totalTax) }}</span></div>
          </div>
        </div>
      </div>

      <!-- 篩選 -->
      <mat-card appearance="outlined" class="filter-card">
        <mat-card-content>
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>類型</mat-label>
              <mat-select [(ngModel)]="filterType" (ngModelChange)="applyFilter()">
                <mat-option value="valid">全部正常</mat-option>
                <mat-option value="b2c">自然人(B2C)</mat-option>
                <mat-option value="b2b">法人(B2B)</mat-option>
                <mat-option value="void">作廢</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field search-field">
              <mat-label>搜尋</mat-label>
              <mat-icon matPrefix>search</mat-icon>
              <input matInput [(ngModel)]="searchText" (ngModelChange)="applyFilter()" placeholder="發票號碼 / 統編 / 名稱">
            </mat-form-field>
            <span class="result-count">顯示 {{ filteredRows().length }} 筆</span>
            <button mat-stroked-button (click)="svc.exportCsv(allRows(), generalRatePct / 100)">
              <mat-icon>download</mat-icon> 匯出 CSV
            </button>
            <button mat-button (click)="reset()">
              <mat-icon>clear</mat-icon> 清除
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- 表格 -->
      <mat-card appearance="outlined" class="table-card">
        <mat-card-content>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>狀態</th><th>發票號碼</th><th>發票日期</th><th>單位代碼</th>
                  <th>買受人統編</th><th>買受人名稱</th>
                  <th class="num">銷售額<br><span class="th-sub">(B2B未稅/B2C含稅)</span></th>
                  <th class="num">零稅銷售額</th><th class="num">免稅銷售額</th>
                  <th class="num">明細稅額</th><th class="num">合計(參考)</th>
                </tr>
              </thead>
              <tbody>
                @for (r of filteredRows(); track r.invNo + r.date) {
                  <tr [class.void-row]="r.isVoid">
                    <td>
                      @if (r.isVoid) { <span class="badge badge-void">❌ 作廢</span> }
                      @else { <span class="badge badge-valid">✅ 正常</span> }
                    </td>
                    <td class="mono">{{ r.invNo }}</td>
                    <td>{{ r.date }}</td>
                    <td>{{ r.unit }}</td>
                    <td class="mono">
                      {{ r.buyerId }}
                      @if (r.isB2C) { <span class="badge badge-b2c">B2C</span> }
                      @else { <span class="badge badge-b2b">B2B</span> }
                    </td>
                    <td>{{ r.buyerName }}</td>
                    <td class="num">{{ r.taxableAmt.toLocaleString() }}</td>
                    <td class="num">{{ r.zeroTaxAmt.toLocaleString() }}</td>
                    <td class="num">{{ r.exemptAmt.toLocaleString() }}</td>
                    <td class="num">
                      @if (r.isB2C && r.taxableAmt > 0) {
                        <span class="muted-text">內含</span>
                      } @else {
                        <span class="red-text">{{ r.taxAmt.toLocaleString() }}</span>
                      }
                    </td>
                    <td class="num">{{ r.totalAmt.toLocaleString() }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    }
  </div>
</app-tool-layout>
  `,
  styles: [`
    .tool-content { padding-bottom: 60px; }
    .rate-card { margin-bottom: 20px; border-color: var(--border-color) !important; }
    .rate-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; padding: 4px 0; }
    .rate-item { display: flex; align-items: center; gap: 12px; }
    .rate-label { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; white-space: nowrap; }
    .rate-input-wrap { display: flex; align-items: center; gap: 4px; }
    .rate-input { width: 72px; padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--surface-alt); color: var(--text-primary); font-size: 1rem; font-weight: 700; text-align: right; outline: none; transition: border-color 200ms; }
    .rate-input:focus { border-color: var(--accent-color); }
    .rate-unit { font-weight: 700; color: var(--text-muted); }

    .drop-zone {
      border: 2px dashed var(--accent-color); border-radius: 16px; padding: 48px 24px;
      text-align: center; cursor: pointer; transition: all 250ms ease;
      background: var(--glass-bg); backdrop-filter: blur(10px); margin-bottom: 28px;
    }
    .drop-zone:hover, .drop-zone.dragover {
      background: color-mix(in srgb, var(--accent-color) 8%, var(--surface-color));
      border-color: var(--text-primary); transform: scale(1.01);
    }
    .drop-icon { font-size: 48px; width: 48px; height: 48px; color: var(--accent-color); margin-bottom: 12px; }
    .drop-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .drop-sub { font-size: 0.85rem; color: var(--text-muted); }

    .stats-section { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
    .stat-group { background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px 24px; box-shadow: var(--card-shadow); }
    .stat-group-title { font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
    .stat-grid { display: flex; gap: 12px; flex-wrap: wrap; }
    .stat-card { background: var(--surface-alt); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px 18px; min-width: 130px; flex: 1; display: flex; flex-direction: column; gap: 4px; transition: transform 200ms; }
    .stat-card:hover { transform: translateY(-2px); }
    .stat-card.accent-card { border-color: var(--accent-color); background: color-mix(in srgb, var(--accent-color) 8%, var(--surface-alt)); }
    .stat-card.total-card { border-color: color-mix(in srgb, #f59e0b 40%, var(--border-color)); }
    .stat-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-val { font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); }
    .stat-sub { font-size: 0.65rem; color: var(--text-muted); }
    .stat-val.green { color: #22c55e; }
    .stat-val.red { color: #ef4444; }
    .stat-val.yellow { color: #f59e0b; }
    .stat-val.accent { color: var(--accent-color); }

    .filter-card { margin-bottom: 16px; }
    .filter-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding: 4px 0; }
    .filter-field { min-width: 140px; margin-bottom: -1.34375em; }
    .search-field { min-width: 200px; flex: 1; }
    .result-count { font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; }

    .table-card { margin-bottom: 24px; }
    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 900px; }
    .data-table th, .data-table td { padding: 10px 14px; border-bottom: 1px solid var(--border-color); text-align: left; }
    .data-table th { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); background: var(--surface-alt); position: sticky; top: 0; }
    .th-sub { font-size: 0.65rem; opacity: 0.7; font-weight: 400; text-transform: none; }
    .data-table tr:hover td { background: color-mix(in srgb, var(--accent-color) 3%, transparent); }
    .data-table tr.void-row td { opacity: 0.4; text-decoration: line-through; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .mono { font-family: 'Roboto Mono', monospace; font-size: 0.82rem; }
    .muted-text { color: var(--text-muted); font-size: 0.82rem; }
    .red-text { color: #ef4444; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; margin-right: 3px; }
    .badge-valid { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; }
    .badge-void { background: color-mix(in srgb, #ef4444 15%, transparent); color: #ef4444; }
    .badge-b2c { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; }
    .badge-b2b { background: color-mix(in srgb, #f59e0b 15%, transparent); color: #f59e0b; }
  `],
})
export class TradevanParserComponent {
  svc = inject(TradevanParserService);

  generalRatePct = 5;
  isDragging  = signal(false);
  allRows     = signal<TradevanRecord[]>([]);
  filteredRows = signal<TradevanRecord[]>([]);

  filterType  = 'valid';
  searchText  = '';

  readonly stats = computed(() =>
    this.svc.calcStats(this.allRows(), this.generalRatePct / 100)
  );

  onDragOver(e: DragEvent)  { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging.set(false); }
  onDrop(e: DragEvent)      { e.preventDefault(); this.isDragging.set(false); this.handleFiles(e.dataTransfer?.files); }
  onFileChange(e: Event)    { this.handleFiles((e.target as HTMLInputElement).files); }

  private async handleFiles(files: FileList | null | undefined) {
    if (!files?.length) return;
    const parsed: TradevanRecord[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      parsed.push(...this.svc.parseCSV(text));
    }
    this.allRows.set(parsed);
    this.applyFilter();
  }

  applyFilter() {
    const rows = this.allRows().filter(r => {
      if (this.filterType === 'void'  && !r.isVoid) return false;
      if (this.filterType !== 'void'  && r.isVoid) return false;
      if (this.filterType === 'b2c'   && !r.isB2C) return false;
      if (this.filterType === 'b2b'   && r.isB2C) return false;
      if (this.searchText) {
        const hay = (r.invNo + r.buyerId + r.buyerName).toLowerCase();
        if (!hay.includes(this.searchText.toLowerCase())) return false;
      }
      return true;
    });
    this.filteredRows.set(rows);
  }

  reset() {
    this.allRows.set([]);
    this.filteredRows.set([]);
    this.filterType = 'valid';
    this.searchText = '';
  }

  fmt(n: number) { return '$' + n.toLocaleString(); }
}
