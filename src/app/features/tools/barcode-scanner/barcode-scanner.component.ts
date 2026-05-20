import {
  Component,
  signal,
  computed,
  ElementRef,
  viewChild,
  OnDestroy,
  afterNextRender,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToolLayoutComponent } from '../tool-layout.component';

// ─── Types ───────────────────────────────────────────────────────────────────
type ScanMode = 'continuous' | 'qty' | 'manual';

interface ScanRecord {
  id: string;
  barcode: string;
  qty: number;
  timestamp: Date;
  count: number; // total scan hits (for merge mode)
}

interface CameraDevice {
  id: string;
  label: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'barcode-scanner-records';
const COOLDOWN_MS_DEFAULT = 2000;
const HTML5QR_CDN = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ToolLayoutComponent,
  ],
  template: `
    <app-tool-layout
      title="條碼掃描器"
      description="取代 PDA 掃描機，用鏡頭連續掃描 QR Code、Data Matrix 等二維條碼，支援數量登錄與 CSV 匯出。"
      [fullWidth]="true">

      <div class="scanner-layout">

        <!-- ═══════════════ LEFT: Scanner Control ═══════════════ -->
        <div class="scanner-panel">

          <!-- Mode Selector -->
          <div class="mode-tabs">
            @for (m of modes; track m.value) {
              <button class="mode-tab" [class.active]="scanMode() === m.value"
                (click)="switchMode(m.value)" [matTooltip]="m.desc">
                <mat-icon>{{ m.icon }}</mat-icon>
                <span>{{ m.label }}</span>
              </button>
            }
          </div>

          <!-- Camera Viewfinder -->
          @if (scanMode() !== 'manual') {
            <div class="viewfinder-wrapper">
              <div class="viewfinder" [class.scanning]="isScanning()" [class.error]="cameraError()">
                <!-- html5-qrcode mounts here -->
                <div id="html5-qrcode-reader" class="qr-reader-container"></div>

                <!-- Scan animation overlay -->
                @if (isScanning() && !cameraError()) {
                  <div class="scan-overlay">
                    <div class="scan-frame">
                      <span class="corner tl"></span>
                      <span class="corner tr"></span>
                      <span class="corner bl"></span>
                      <span class="corner br"></span>
                      <div class="scan-line"></div>
                    </div>
                  </div>
                }

                <!-- Flash feedback -->
                @if (flashSuccess()) {
                  <div class="flash-success"></div>
                }

                <!-- Camera Error -->
                @if (cameraError()) {
                  <div class="camera-error-state">
                    <mat-icon>no_photography</mat-icon>
                    <p>{{ cameraError() }}</p>
                  </div>
                }

                <!-- Idle state -->
                @if (!isScanning() && !cameraError()) {
                  <div class="camera-idle-state">
                    <mat-icon>camera_alt</mat-icon>
                    <p>按下「開始掃描」啟動鏡頭</p>
                  </div>
                }
              </div>

              <!-- Camera Controls Row -->
              <div class="camera-controls">
                <!-- Start / Stop -->
                @if (!isScanning()) {
                  <button mat-flat-button color="primary" class="scan-btn"
                    (click)="startScanning()" [disabled]="isLoading()">
                    @if (isLoading()) {
                      <mat-icon class="spin">refresh</mat-icon>
                    } @else {
                      <mat-icon>play_circle</mat-icon>
                    }
                    {{ isLoading() ? '載入中...' : '開始掃描' }}
                  </button>
                } @else {
                  <button mat-stroked-button class="scan-btn stop-btn" (click)="stopScanning()">
                    <mat-icon>stop_circle</mat-icon> 停止掃描
                  </button>
                }

                <!-- Camera switch -->
                @if (cameras().length > 1) {
                  <button mat-icon-button (click)="switchCamera()"
                    matTooltip="切換鏡頭" [disabled]="!isScanning()">
                    <mat-icon>flip_camera_ios</mat-icon>
                  </button>
                }

                <!-- Torch toggle (mobile) -->
                @if (hasTorch()) {
                  <button mat-icon-button (click)="toggleTorch()"
                    [matTooltip]="torchOn() ? '關閉手電筒' : '開啟手電筒'">
                    <mat-icon>{{ torchOn() ? 'flashlight_off' : 'flashlight_on' }}</mat-icon>
                  </button>
                }
              </div>

              <!-- Status bar -->
              <div class="status-bar" [class.active]="isScanning()">
                <span class="status-dot"></span>
                <span>{{ statusText() }}</span>
                @if (cooldownActive()) {
                  <span class="cooldown-badge">防誤掃冷卻中</span>
                }
              </div>
            </div>
          }

          <!-- Manual Input Mode -->
          @if (scanMode() === 'manual') {
            <div class="manual-input-area">
              <div class="manual-icon">
                <mat-icon>keyboard</mat-icon>
              </div>
              <p class="manual-hint">輸入或貼上條碼值，按 Enter 或點擊「新增」</p>
              <div class="manual-form">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>條碼值</mat-label>
                  <input matInput #manualInput
                    [(ngModel)]="manualBarcode"
                    (keydown.enter)="submitManual()"
                    placeholder="在此輸入或貼上條碼..."
                    autocomplete="off">
                  <mat-icon matPrefix>qr_code</mat-icon>
                </mat-form-field>
                <mat-form-field appearance="outline" style="width: 120px; flex-shrink: 0;">
                  <mat-label>數量</mat-label>
                  <input matInput type="number" min="1" [(ngModel)]="manualQty">
                </mat-form-field>
                <button mat-flat-button color="primary" (click)="submitManual()"
                  [disabled]="!manualBarcode.trim()">
                  <mat-icon>add</mat-icon> 新增
                </button>
              </div>
            </div>
          }

          <!-- ── Settings Accordion ── -->
          <div class="settings-section">
            <button class="settings-header" (click)="showSettings = !showSettings">
              <mat-icon>tune</mat-icon>
              <span>掃描設定</span>
              <mat-icon class="chevron" [class.open]="showSettings">expand_more</mat-icon>
            </button>
            @if (showSettings) {
              <div class="settings-body">

                <div class="setting-row">
                  <span class="setting-label">
                    <mat-icon>timer</mat-icon>
                    防誤掃冷卻: {{ cooldownMs() / 1000 }}s
                  </span>
                  <input type="range" min="500" max="5000" step="500"
                    [value]="cooldownMs()"
                    (input)="cooldownMs.set(+$any($event.target).value)">
                </div>

                <div class="setting-row">
                  <span class="setting-label">
                    <mat-icon>content_copy</mat-icon>
                    允許重複掃描相同條碼
                  </span>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="allowDuplicates">
                    <span class="slider"></span>
                  </label>
                </div>

                <div class="setting-row">
                  <span class="setting-label">
                    <mat-icon>merge</mat-icon>
                    合併相同條碼（累計數量）
                  </span>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="mergeRecords">
                    <span class="slider"></span>
                  </label>
                </div>

                <div class="setting-row">
                  <span class="setting-label">
                    <mat-icon>music_note</mat-icon>
                    掃描成功音效
                  </span>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="beepEnabled">
                    <span class="slider"></span>
                  </label>
                </div>

                <div class="setting-row">
                  <span class="setting-label">
                    <mat-icon>vibration</mat-icon>
                    震動回饋（行動裝置）
                  </span>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="vibrateEnabled">
                    <span class="slider"></span>
                  </label>
                </div>

              </div>
            }
          </div>

        </div>

        <!-- ═══════════════ RIGHT: Scan Records ═══════════════ -->
        <div class="records-panel">

          <!-- Records Header -->
          <div class="records-header">
            <div class="records-title">
              <mat-icon>list_alt</mat-icon>
              <span>掃描清單</span>
              <span class="record-count">{{ records().length }} 筆</span>
            </div>
            <div class="records-actions">
              <button mat-icon-button (click)="copyAll()" matTooltip="複製全部" [disabled]="records().length === 0">
                <mat-icon>content_copy</mat-icon>
              </button>
              <button mat-icon-button (click)="exportCsv()" matTooltip="匯出 CSV" [disabled]="records().length === 0">
                <mat-icon>download</mat-icon>
              </button>
              <button mat-icon-button (click)="clearAll()" matTooltip="清空清單"
                [disabled]="records().length === 0" class="danger-btn">
                <mat-icon>delete_sweep</mat-icon>
              </button>
            </div>
          </div>

          <!-- Search -->
          <div class="search-row">
            <mat-form-field appearance="outline" class="full-width search-field">
              <mat-label>搜尋條碼</mat-label>
              <input matInput [(ngModel)]="searchQuery" placeholder="輸入關鍵字過濾...">
              <mat-icon matPrefix>search</mat-icon>
              @if (searchQuery) {
                <button matSuffix mat-icon-button (click)="searchQuery = ''">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>
          </div>

          <!-- Records List -->
          <div class="records-list">
            @if (filteredRecords().length === 0 && records().length === 0) {
              <div class="empty-records">
                <mat-icon>document_scanner</mat-icon>
                <p>尚無掃描紀錄</p>
                <p class="sub">開始掃描後，結果將顯示於此</p>
              </div>
            } @else if (filteredRecords().length === 0) {
              <div class="empty-records">
                <mat-icon>search_off</mat-icon>
                <p>無符合「{{ searchQuery }}」的紀錄</p>
              </div>
            } @else {
              <!-- Column Headers -->
              <div class="record-row header-row">
                <span class="col-index">#</span>
                <span class="col-barcode">條碼值</span>
                <span class="col-qty">數量</span>
                <span class="col-time">時間</span>
                <span class="col-action"></span>
              </div>

              @for (rec of filteredRecords(); track rec.id; let i = $index) {
                <div class="record-row" [class.new-flash]="rec.id === lastScannedId()">
                  <span class="col-index">{{ i + 1 }}</span>
                  <span class="col-barcode">
                    <span class="barcode-value" [title]="rec.barcode">{{ rec.barcode }}</span>
                    @if (rec.count > 1) {
                      <span class="hit-badge">×{{ rec.count }}</span>
                    }
                  </span>
                  <span class="col-qty">
                    <div class="qty-control">
                      <button class="qty-btn" (click)="adjustQty(rec, -1)" [disabled]="rec.qty <= 1">－</button>
                      <input class="qty-input" type="number" min="1"
                        [value]="rec.qty"
                        (change)="setQty(rec, +$any($event.target).value)"
                        (click)="$any($event.target).select()">
                      <button class="qty-btn" (click)="adjustQty(rec, 1)">＋</button>
                    </div>
                  </span>
                  <span class="col-time">{{ formatTime(rec.timestamp) }}</span>
                  <span class="col-action">
                    <button class="del-btn" (click)="deleteRecord(rec.id)" matTooltip="刪除">
                      <mat-icon>close</mat-icon>
                    </button>
                  </span>
                </div>
              }
            }
          </div>

          <!-- Summary Footer -->
          @if (records().length > 0) {
            <div class="records-footer">
              <div class="summary-stat">
                <mat-icon>inventory_2</mat-icon>
                <span>品項: <strong>{{ uniqueSkuCount() }}</strong></span>
              </div>
              <div class="summary-stat">
                <mat-icon>numbers</mat-icon>
                <span>總數量: <strong>{{ totalQty() }}</strong></span>
              </div>
              <div class="summary-stat">
                <mat-icon>schedule</mat-icon>
                <span>最後: <strong>{{ lastScanTime() }}</strong></span>
              </div>
            </div>
          }

        </div>

      </div>

    </app-tool-layout>

    <!-- ═══ Qty Dialog Overlay ═══ -->
    @if (qtyDialogVisible()) {
      <div class="dialog-backdrop" (click)="cancelQtyDialog()">
        <div class="qty-dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <mat-icon>qr_code</mat-icon>
            <span>已掃描條碼</span>
          </div>
          <div class="dialog-barcode">{{ pendingBarcode() }}</div>

          <div class="dialog-qty-row">
            <button class="qty-dialog-btn" (click)="dialogQty = Math.max(1, dialogQty - 1)">－</button>
            <input class="qty-dialog-input" type="number" min="1"
              [(ngModel)]="dialogQty"
              (focus)="$any($event.target).select()"
              (keydown.enter)="confirmQtyDialog()">
            <button class="qty-dialog-btn" (click)="dialogQty = dialogQty + 1">＋</button>
          </div>
          <p class="dialog-hint">輸入數量後按確認，或按 Enter</p>

          <div class="dialog-actions">
            <button mat-stroked-button (click)="cancelQtyDialog()">取消</button>
            <button mat-flat-button color="primary" (click)="confirmQtyDialog()">
              <mat-icon>check</mat-icon> 確認
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Layout ── */
    .scanner-layout {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 28px;
      align-items: start;
      padding-bottom: 64px;
    }
    @media (max-width: 960px) {
      .scanner-layout { grid-template-columns: 1fr; }
    }

    /* ── Mode Tabs ── */
    .mode-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 20px;
      background: color-mix(in srgb, currentColor 4%, transparent);
      padding: 5px;
      border-radius: 14px;
    }
    .mode-tab {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 10px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 500;
      font-family: inherit;
      transition: all 200ms ease;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    .mode-tab:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
    .mode-tab.active {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    /* ── Viewfinder ── */
    .viewfinder-wrapper { display: flex; flex-direction: column; gap: 12px; }
    .viewfinder {
      position: relative;
      width: 100%;
      aspect-ratio: 4/3;
      border-radius: 16px;
      overflow: hidden;
      background: #0a0a0f;
      border: 2px solid color-mix(in srgb, currentColor 12%, transparent);
      transition: border-color 300ms;
    }
    .viewfinder.scanning {
      border-color: var(--mat-sys-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--mat-sys-primary) 20%, transparent);
    }
    .viewfinder.error { border-color: var(--mat-sys-error, #f44336); }

    /* html5-qrcode container override */
    .qr-reader-container {
      width: 100%; height: 100%;
      position: absolute; inset: 0;
    }
    ::ng-deep #html5-qrcode-reader video {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      border-radius: 14px;
    }
    ::ng-deep #html5-qrcode-reader img,
    ::ng-deep #html5-qrcode-reader #html5-qrcode-anchor-scan-type-change,
    ::ng-deep #html5-qrcode-reader__header_message,
    ::ng-deep #html5-qrcode-reader__status_span,
    ::ng-deep #html5-qrcode-reader__dashboard { display: none !important; }
    ::ng-deep #html5-qrcode-reader__scan_region { border: none !important; }

    /* Scan Overlay */
    .scan-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }
    .scan-frame {
      position: relative;
      width: 55%; aspect-ratio: 1;
    }
    .corner {
      position: absolute;
      width: 20px; height: 20px;
      border-color: #fff;
      border-style: solid;
      opacity: 0.9;
    }
    .corner.tl { top: 0; left: 0; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
    .corner.tr { top: 0; right: 0; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
    .corner.bl { bottom: 0; left: 0; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
    .corner.br { bottom: 0; right: 0; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }
    .scan-line {
      position: absolute;
      left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--mat-sys-primary), transparent);
      animation: scan-sweep 2s ease-in-out infinite;
      box-shadow: 0 0 8px var(--mat-sys-primary);
    }
    @keyframes scan-sweep {
      0% { top: 8%; opacity: 1; }
      50% { top: 88%; opacity: 1; }
      100% { top: 8%; opacity: 1; }
    }

    /* Flash success */
    .flash-success {
      position: absolute; inset: 0;
      background: color-mix(in srgb, var(--mat-sys-primary) 30%, transparent);
      animation: flash 400ms ease-out forwards;
      border-radius: 14px;
      pointer-events: none;
    }
    @keyframes flash {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }

    /* Camera idle / error states */
    .camera-idle-state, .camera-error-state {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; color: rgba(255,255,255,0.5);
      text-align: center; padding: 20px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.4; }
      p { font-size: 0.875rem; margin: 0; }
    }
    .camera-error-state { color: rgba(255, 100, 100, 0.8); }
    .camera-error-state mat-icon { opacity: 0.7; }

    /* Camera controls */
    .camera-controls {
      display: flex; gap: 8px; align-items: center;
    }
    .scan-btn {
      flex: 1;
      height: 44px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .stop-btn { border-color: var(--mat-sys-error, #f44336) !important; color: var(--mat-sys-error, #f44336) !important; }

    /* Status bar */
    .status-bar {
      display: flex; align-items: center; gap: 8px;
      font-size: 0.8rem;
      color: color-mix(in srgb, currentColor 55%, transparent);
      padding: 6px 10px;
      border-radius: 8px;
      background: color-mix(in srgb, currentColor 4%, transparent);
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: color-mix(in srgb, currentColor 25%, transparent);
      flex-shrink: 0;
      transition: background 300ms;
    }
    .status-bar.active .status-dot {
      background: #4caf50;
      box-shadow: 0 0 6px #4caf5099;
      animation: pulse-dot 1.5s ease-in-out infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .cooldown-badge {
      margin-left: auto;
      padding: 2px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent);
      color: var(--mat-sys-primary);
      font-size: 0.72rem;
      font-weight: 600;
    }

    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; display: inline-block; }

    /* ── Manual Input ── */
    .manual-input-area {
      display: flex; flex-direction: column; gap: 16px;
      padding: 24px;
      border: 2px dashed color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 16px;
      background: color-mix(in srgb, currentColor 2%, transparent);
    }
    .manual-icon {
      display: flex; justify-content: center;
      mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.3; }
    }
    .manual-hint { text-align: center; font-size: 0.875rem; opacity: 0.6; margin: 0; }
    .manual-form { display: flex; gap: 10px; align-items: flex-start; }
    .full-width { width: 100%; }

    /* ── Settings Section ── */
    .settings-section {
      margin-top: 16px;
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 12px;
      overflow: hidden;
    }
    .settings-header {
      width: 100%;
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px;
      background: color-mix(in srgb, currentColor 3%, transparent);
      border: none; cursor: pointer; color: inherit;
      font-size: 0.875rem; font-family: inherit; font-weight: 500;
      transition: background 200ms;
      mat-icon { font-size: 18px; width: 18px; height: 18px; opacity: 0.6; }
    }
    .settings-header:hover { background: color-mix(in srgb, currentColor 6%, transparent); }
    .settings-header .chevron {
      margin-left: auto;
      transition: transform 200ms;
    }
    .settings-header .chevron.open { transform: rotate(180deg); }
    .settings-body {
      display: flex; flex-direction: column; gap: 0;
      padding: 8px 0;
      animation: slideDown 200ms ease;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .setting-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      padding: 10px 16px;
      font-size: 0.8rem;
    }
    .setting-row:hover { background: color-mix(in srgb, currentColor 3%, transparent); }
    .setting-label {
      display: flex; align-items: center; gap: 6px;
      opacity: 0.75;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .setting-row input[type=range] { width: 100px; accent-color: var(--mat-sys-primary); }

    /* Toggle */
    .toggle { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle .slider {
      position: absolute; cursor: pointer; inset: 0;
      background: color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 22px; transition: 0.3s;
    }
    .toggle .slider:before {
      position: absolute; content: '';
      height: 16px; width: 16px; left: 3px; bottom: 3px;
      background: white; border-radius: 50%; transition: 0.3s;
    }
    .toggle input:checked + .slider { background: var(--mat-sys-primary); }
    .toggle input:checked + .slider:before { transform: translateX(18px); }

    /* ══════════════════════════════════════════════════════════
       RIGHT: Records Panel
    ══════════════════════════════════════════════════════════ */
    .records-panel {
      display: flex; flex-direction: column; gap: 0;
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 20px;
      overflow: hidden;
      background: color-mix(in srgb, currentColor 2%, transparent);
      position: sticky;
      top: 88px;
      max-height: calc(100vh - 120px);
    }

    .records-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
      background: color-mix(in srgb, currentColor 3%, transparent);
      flex-shrink: 0;
    }
    .records-title {
      display: flex; align-items: center; gap: 8px;
      font-weight: 600; font-size: 0.9rem;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--mat-sys-primary); }
    }
    .record-count {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font-size: 0.75rem;
      font-weight: 700;
      min-width: 28px;
      text-align: center;
    }
    .records-actions { display: flex; gap: 4px; }
    .danger-btn { color: var(--mat-sys-error, #f44336) !important; }

    .search-row {
      padding: 12px 16px 0;
      flex-shrink: 0;
    }
    .search-field { width: 100%; }

    /* Records List */
    .records-list {
      flex: 1;
      overflow-y: auto;
      min-height: 200px;
      max-height: calc(100vh - 360px);
    }
    .records-list::-webkit-scrollbar { width: 4px; }
    .records-list::-webkit-scrollbar-track { background: transparent; }
    .records-list::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 4px;
    }

    .empty-records {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 8px; padding: 48px 20px;
      opacity: 0.4; text-align: center;
      mat-icon { font-size: 48px; width: 48px; height: 48px; }
      p { margin: 0; font-size: 0.9rem; }
      p.sub { font-size: 0.78rem; opacity: 0.7; }
    }

    /* Record Rows */
    .record-row {
      display: grid;
      grid-template-columns: 36px 1fr 130px 56px 32px;
      align-items: center;
      gap: 0;
      padding: 0 8px;
      border-bottom: 1px solid color-mix(in srgb, currentColor 5%, transparent);
      transition: background 150ms;
      min-height: 48px;
    }
    .record-row:not(.header-row):hover { background: color-mix(in srgb, currentColor 4%, transparent); }
    .header-row {
      background: color-mix(in srgb, currentColor 5%, transparent);
      font-size: 0.72rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.06em;
      opacity: 0.55; min-height: 32px;
      position: sticky; top: 0; z-index: 1;
    }

    @keyframes rowFlash {
      0% { background: color-mix(in srgb, var(--mat-sys-primary) 25%, transparent); }
      100% { background: transparent; }
    }
    .new-flash { animation: rowFlash 600ms ease-out; }

    .col-index { font-size: 0.75rem; opacity: 0.4; text-align: center; }
    .col-barcode {
      padding: 0 8px;
      overflow: hidden;
      display: flex; align-items: center; gap: 6px;
    }
    .barcode-value {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.82rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .hit-badge {
      flex-shrink: 0;
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent);
      color: var(--mat-sys-primary);
      font-weight: 700;
    }
    .col-qty { padding: 4px 4px; }
    .col-time {
      font-size: 0.72rem;
      opacity: 0.5;
      text-align: center;
    }
    .col-action { display: flex; justify-content: center; }

    .qty-control {
      display: flex; align-items: center; gap: 2px;
    }
    .qty-btn {
      width: 24px; height: 24px;
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 6px; background: transparent;
      color: inherit; cursor: pointer; font-size: 0.9rem; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      transition: all 150ms;
      padding: 0;
    }
    .qty-btn:hover:not(:disabled) {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      border-color: transparent;
    }
    .qty-btn:disabled { opacity: 0.3; cursor: default; }
    .qty-input {
      width: 44px; height: 24px;
      text-align: center;
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 6px;
      background: transparent; color: inherit;
      font-size: 0.82rem; font-family: inherit;
      outline: none;
    }
    .qty-input:focus { border-color: var(--mat-sys-primary); }
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

    .del-btn {
      width: 28px; height: 28px;
      border: none; border-radius: 6px;
      background: transparent; color: inherit;
      cursor: pointer; opacity: 0.35;
      display: flex; align-items: center; justify-content: center;
      transition: all 150ms;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .del-btn:hover { opacity: 1; color: var(--mat-sys-error, #f44336); background: color-mix(in srgb, var(--mat-sys-error, #f44336) 10%, transparent); }

    /* Footer Summary */
    .records-footer {
      display: flex; justify-content: space-around;
      padding: 12px 16px;
      border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);
      background: color-mix(in srgb, currentColor 3%, transparent);
      flex-shrink: 0;
    }
    .summary-stat {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.8rem;
      color: color-mix(in srgb, currentColor 65%, transparent);
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      strong { color: var(--mat-sys-primary); }
    }

    /* ══════════════════════════════════════════════════════════
       Qty Dialog
    ══════════════════════════════════════════════════════════ */
    .dialog-backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
      animation: fadeIn 150ms ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .qty-dialog {
      background: var(--mat-sys-surface, #1e1e2e);
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 20px;
      padding: 28px;
      width: 340px;
      display: flex; flex-direction: column; gap: 20px;
      animation: dialogIn 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    @keyframes dialogIn {
      from { opacity: 0; transform: scale(0.9) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .dialog-header {
      display: flex; align-items: center; gap: 10px;
      font-size: 0.875rem; font-weight: 600;
      opacity: 0.7;
      mat-icon { color: var(--mat-sys-primary); }
    }
    .dialog-barcode {
      font-family: 'Roboto Mono', monospace;
      font-size: 1.1rem;
      font-weight: 700;
      word-break: break-all;
      padding: 14px 18px;
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 25%, transparent);
      border-radius: 12px;
      letter-spacing: 0.05em;
    }
    .dialog-qty-row {
      display: flex; align-items: center; gap: 12px; justify-content: center;
    }
    .qty-dialog-btn {
      width: 44px; height: 44px;
      border: 2px solid color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 12px;
      background: transparent; color: inherit;
      cursor: pointer; font-size: 1.4rem; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      transition: all 150ms;
    }
    .qty-dialog-btn:hover {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      border-color: transparent;
    }
    .qty-dialog-input {
      width: 90px; height: 52px;
      text-align: center;
      font-size: 1.5rem; font-weight: 700;
      border: 2px solid var(--mat-sys-primary);
      border-radius: 12px;
      background: transparent; color: inherit;
      font-family: inherit; outline: none;
    }
    .dialog-hint {
      text-align: center; font-size: 0.78rem; opacity: 0.45; margin: -8px 0;
    }
    .dialog-actions {
      display: flex; gap: 10px;
      button { flex: 1; height: 44px; }
    }
  `],
})
export class BarcodeScannerComponent implements OnDestroy {
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  // ── Signals ──────────────────────────────────────────────────────────────
  scanMode = signal<ScanMode>('continuous');
  isScanning = signal(false);
  isLoading = signal(false);
  cameraError = signal('');
  flashSuccess = signal(false);
  cooldownActive = signal(false);
  qtyDialogVisible = signal(false);
  pendingBarcode = signal('');
  lastScannedId = signal('');
  cameras = signal<CameraDevice[]>([]);
  hasTorch = signal(false);
  torchOn = signal(false);
  records = signal<ScanRecord[]>([]);

  // ── Non-signal state ──────────────────────────────────────────────────────
  manualBarcode = '';
  manualQty = 1;
  searchQuery = '';
  showSettings = false;
  dialogQty = 1;
  beepEnabled = true;
  vibrateEnabled = true;
  allowDuplicates = false;
  mergeRecords = true;
  cooldownMs = signal(COOLDOWN_MS_DEFAULT);

  Math = Math; // expose to template

  // ── Private state ─────────────────────────────────────────────────────────
  private html5QrCode: any = null;
  private currentCameraIndex = 0;
  private cooldownMap = new Map<string, number>();
  private audioCtx: AudioContext | null = null;
  private flashTimer: any = null;

  // ── Computed ──────────────────────────────────────────────────────────────
  modes = [
    { value: 'continuous' as ScanMode, label: '連續掃描', icon: 'loop', desc: '掃到條碼後自動記錄，不中斷鏡頭' },
    { value: 'qty' as ScanMode, label: '掃描+數量', icon: 'edit_note', desc: '每次掃描後彈出數量輸入框' },
    { value: 'manual' as ScanMode, label: '手動輸入', icon: 'keyboard', desc: '直接鍵入條碼值（相容外接掃描槍）' },
  ];

  filteredRecords = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.records();
    return this.records().filter(r => r.barcode.toLowerCase().includes(q));
  });

  totalQty = computed(() => this.records().reduce((s, r) => s + r.qty, 0));

  uniqueSkuCount = computed(() => new Set(this.records().map(r => r.barcode)).size);

  lastScanTime = computed(() => {
    if (this.records().length === 0) return '—';
    const last = this.records()[this.records().length - 1];
    return this.formatTime(last.timestamp);
  });

  statusText = computed(() => {
    if (!this.isScanning()) return '待機中';
    if (this.scanMode() === 'qty' && this.qtyDialogVisible()) return '等待數量輸入...';
    return '掃描中 — 請對準條碼';
  });

  constructor() {
    afterNextRender(() => {
      this.loadRecordsFromStorage();
      this.loadHtml5QrCode();
      this.initAudioContext();
    });
  }

  // ── Mode Switching ────────────────────────────────────────────────────────
  switchMode(mode: ScanMode) {
    if (this.isScanning()) {
      this.stopScanning();
    }
    this.scanMode.set(mode);
    this.cameraError.set('');
  }

  // ── Library Loading ───────────────────────────────────────────────────────
  private loadHtml5QrCode(): Promise<void> {
    if ((window as any).Html5Qrcode) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = HTML5QR_CDN;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('無法載入掃描庫'));
      document.head.appendChild(script);
    });
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  async startScanning() {
    this.isLoading.set(true);
    this.cameraError.set('');

    try {
      // Ensure library is loaded
      if (!(window as any).Html5Qrcode) {
        await this.loadHtml5QrCode();
      }

      const Html5Qrcode = (window as any).Html5Qrcode;
      const Html5QrcodeSupportedFormats = (window as any).Html5QrcodeSupportedFormats;

      // Enumerate cameras
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('找不到相機裝置，請確認瀏覽器相機權限已開啟。');
      }
      this.cameras.set(devices.map((d: any) => ({ id: d.id, label: d.label || d.id })));

      // Prefer back camera on mobile
      const backIdx = devices.findIndex((d: any) =>
        /back|rear|environment/i.test(d.label)
      );
      this.currentCameraIndex = backIdx >= 0 ? backIdx : 0;

      // Init scanner
      this.html5QrCode = new Html5Qrcode('html5-qrcode-reader', { verbose: false });

      const config: any = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.333,
        formatsToSupport: Html5QrcodeSupportedFormats
          ? [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
              Html5QrcodeSupportedFormats.PDF_417,
              Html5QrcodeSupportedFormats.AZTEC,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.CODE_39,
            ]
          : undefined,
      };

      await this.html5QrCode.start(
        devices[this.currentCameraIndex].id,
        config,
        (decodedText: string) => this.onScanSuccess(decodedText),
        () => {} // ignore errors (frame errors are normal)
      );

      this.isScanning.set(true);

      // Check torch support
      try {
        const capabilities = this.html5QrCode.getRunningTrackCapabilities?.();
        if (capabilities?.torch !== undefined) {
          this.hasTorch.set(true);
        }
      } catch { /* ignore */ }

    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        this.cameraError.set('相機存取被拒絕，請在瀏覽器設定中允許相機存取。');
      } else {
        this.cameraError.set(msg || '啟動相機時發生錯誤。');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async stopScanning() {
    if (this.html5QrCode) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear?.();
      } catch { /* ignore */ }
      this.html5QrCode = null;
    }
    this.isScanning.set(false);
    this.hasTorch.set(false);
    this.torchOn.set(false);
  }

  async switchCamera() {
    const cams = this.cameras();
    if (cams.length < 2 || !this.html5QrCode) return;

    this.currentCameraIndex = (this.currentCameraIndex + 1) % cams.length;
    try {
      await this.html5QrCode.stop();
      const Html5QrcodeSupportedFormats = (window as any).Html5QrcodeSupportedFormats;
      await this.html5QrCode.start(
        cams[this.currentCameraIndex].id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.333,
          formatsToSupport: Html5QrcodeSupportedFormats ? [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.AZTEC,
            Html5QrcodeSupportedFormats.CODE_128,
          ] : undefined,
        },
        (decodedText: string) => this.onScanSuccess(decodedText),
        () => {}
      );
    } catch (err: any) {
      this.cameraError.set(err?.message || '切換鏡頭失敗');
    }
  }

  async toggleTorch() {
    if (!this.html5QrCode) return;
    try {
      const newState = !this.torchOn();
      await this.html5QrCode.applyVideoConstraints?.({ advanced: [{ torch: newState }] });
      this.torchOn.set(newState);
    } catch { /* torch not available */ }
  }

  // ── Scan Success Handler ──────────────────────────────────────────────────
  onScanSuccess(barcode: string) {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    // Cooldown check
    if (!this.allowDuplicates) {
      const lastScan = this.cooldownMap.get(trimmed) ?? 0;
      const now = Date.now();
      if (now - lastScan < this.cooldownMs()) {
        this.cooldownActive.set(true);
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => this.cooldownActive.set(false), 800);
        return;
      }
      this.cooldownMap.set(trimmed, now);
    }

    // Feedback
    this.triggerFlash();
    if (this.beepEnabled) this.playBeep();
    if (this.vibrateEnabled && navigator.vibrate) navigator.vibrate(80);

    if (this.scanMode() === 'continuous') {
      this.addRecord(trimmed, 1);
    } else if (this.scanMode() === 'qty') {
      this.pendingBarcode.set(trimmed);
      this.dialogQty = 1;
      this.qtyDialogVisible.set(true);
      this.cdr.detectChanges();
    }
  }

  // ── Record Management ─────────────────────────────────────────────────────
  addRecord(barcode: string, qty: number) {
    const now = new Date();

    if (this.mergeRecords) {
      const existing = this.records().find(r => r.barcode === barcode);
      if (existing) {
        this.records.update(recs =>
          recs.map(r =>
            r.id === existing.id
              ? { ...r, qty: r.qty + qty, count: r.count + 1, timestamp: now }
              : r
          )
        );
        this.lastScannedId.set(existing.id);
        this.saveRecordsToStorage();
        this.cdr.detectChanges();
        return;
      }
    }

    const newRecord: ScanRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      barcode,
      qty,
      timestamp: now,
      count: 1,
    };
    this.records.update(recs => [...recs, newRecord]);
    this.lastScannedId.set(newRecord.id);
    this.saveRecordsToStorage();

    // Clear flash after animation
    setTimeout(() => {
      if (this.lastScannedId() === newRecord.id) this.lastScannedId.set('');
    }, 700);

    this.cdr.detectChanges();
  }

  adjustQty(rec: ScanRecord, delta: number) {
    const newQty = Math.max(1, rec.qty + delta);
    this.records.update(recs => recs.map(r => r.id === rec.id ? { ...r, qty: newQty } : r));
    this.saveRecordsToStorage();
  }

  setQty(rec: ScanRecord, qty: number) {
    const newQty = Math.max(1, isNaN(qty) ? 1 : qty);
    this.records.update(recs => recs.map(r => r.id === rec.id ? { ...r, qty: newQty } : r));
    this.saveRecordsToStorage();
  }

  deleteRecord(id: string) {
    this.records.update(recs => recs.filter(r => r.id !== id));
    this.saveRecordsToStorage();
  }

  clearAll() {
    if (this.records().length === 0) return;
    this.records.set([]);
    this.saveRecordsToStorage();
    this.snackBar.open('✅ 清單已清空', '', { duration: 2000 });
  }

  // ── Qty Dialog ────────────────────────────────────────────────────────────
  confirmQtyDialog() {
    const qty = Math.max(1, this.dialogQty || 1);
    this.addRecord(this.pendingBarcode(), qty);
    this.qtyDialogVisible.set(false);
    this.pendingBarcode.set('');
  }

  cancelQtyDialog() {
    this.qtyDialogVisible.set(false);
    this.pendingBarcode.set('');
  }

  // ── Manual Input ──────────────────────────────────────────────────────────
  submitManual() {
    const barcode = this.manualBarcode.trim();
    if (!barcode) return;
    this.addRecord(barcode, Math.max(1, this.manualQty || 1));
    this.manualBarcode = '';
    this.manualQty = 1;
    if (this.beepEnabled) this.playBeep();
  }

  // ── Export ────────────────────────────────────────────────────────────────
  exportCsv() {
    const header = '序號,條碼值,數量,掃描時間\n';
    const rows = this.records().map((r, i) =>
      `${i + 1},"${r.barcode.replace(/"/g, '""')}",${r.qty},"${this.formatDateTime(r.timestamp)}"`
    ).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `scan-${this.formatFileDate()}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    this.snackBar.open('✅ CSV 已下載', '', { duration: 2000 });
  }

  copyAll() {
    const text = this.records().map(r => `${r.barcode}\t${r.qty}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('✅ 已複製到剪貼簿', '', { duration: 2000 });
    }).catch(() => {
      this.snackBar.open('❌ 複製失敗', '', { duration: 2000 });
    });
  }

  // ── localStorage ─────────────────────────────────────────────────────────
  private saveRecordsToStorage() {
    try {
      const serialized = this.records().map(r => ({
        ...r,
        timestamp: r.timestamp.toISOString(),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch { /* storage full, ignore */ }
  }

  private loadRecordsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.records.set(
          parsed.map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp),
            count: r.count ?? 1,
          }))
        );
      }
    } catch { /* ignore */ }
  }

  // ── Audio Feedback ────────────────────────────────────────────────────────
  private initAudioContext() {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { /* not supported */ }
  }

  playBeep() {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1800, this.audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(900, this.audioCtx.currentTime + 0.06);
      gainNode.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.12);
      oscillator.start(this.audioCtx.currentTime);
      oscillator.stop(this.audioCtx.currentTime + 0.12);
    } catch { /* ignore */ }
  }

  // ── Flash Effect ──────────────────────────────────────────────────────────
  private triggerFlash() {
    this.flashSuccess.set(true);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.flashSuccess.set(false);
      this.cdr.detectChanges();
    }, 400);
  }

  // ── Formatting Helpers ────────────────────────────────────────────────────
  formatTime(d: Date): string {
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatDateTime(d: Date): string {
    return d.toLocaleString('zh-TW');
  }

  private formatFileDate(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  ngOnDestroy() {
    this.stopScanning();
    clearTimeout(this.flashTimer);
    this.audioCtx?.close();
  }
}
