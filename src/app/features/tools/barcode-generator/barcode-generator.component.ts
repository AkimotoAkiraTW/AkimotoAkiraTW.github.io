import {
  Component,
  signal,
  computed,
  ElementRef,
  viewChild,
  inject,
  afterNextRender,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ToolLayoutComponent } from '../tool-layout.component';

// ---------- Type declarations for dynamic imports ----------
declare const QRCode: any;

type BarcodeMode = 'qrcode' | '2d' | '1d';
type QrTemplate = 'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms';
type BarcodeType2D = 'datamatrix' | 'pdf417' | 'azteccode';
type BarcodeType1D = 'code128' | 'ean13' | 'upca' | 'code39' | 'qr';
type WifiEncryption = 'WPA' | 'WEP' | 'nopass';
type EcLevel = 'L' | 'M' | 'Q' | 'H';
type GradientDir = 'to-bottom' | 'to-right' | 'diagonal';

interface WifiData {
  ssid: string;
  password: string;
  encryption: WifiEncryption;
  hidden: boolean;
}

interface VcardData {
  name: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  url: string;
  address: string;
}

interface EmailData {
  to: string;
  subject: string;
  body: string;
}

interface SmsData {
  phone: string;
  message: string;
}

@Component({
  selector: 'app-barcode-generator',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatExpansionModule,
    MatTooltipModule,
    MatSnackBarModule,
    ToolLayoutComponent,
  ],
  template: `
    <app-tool-layout
      title="條碼與 QR Code 產生器"
      description="即時產生 QR Code、Data Matrix、PDF417 等各式條碼，支援漸層色彩、Logo 置入與向量下載。"
      [fullWidth]="true">

      <div class="generator-layout">

        <!-- ═══════════════ LEFT: Controls ═══════════════ -->
        <div class="controls-panel">

          <!-- ── Mode Selector ── -->
          <div class="mode-selector">
            @for (m of modes; track m.value) {
              <button
                [class.active]="barcodeMode() === m.value"
                (click)="switchMode(m.value)"
                class="mode-btn">
                <mat-icon>{{ m.icon }}</mat-icon>
                <span>{{ m.label }}</span>
              </button>
            }
          </div>

          <!-- ── QR Code Controls ── -->
          @if (barcodeMode() === 'qrcode') {

            <!-- Template Chips -->
            <div class="template-chips">
              @for (t of qrTemplates; track t.value) {
                <button
                  class="template-chip"
                  [class.active]="qrTemplate() === t.value"
                  (click)="setTemplate(t.value)">
                  <mat-icon>{{ t.icon }}</mat-icon>{{ t.label }}
                </button>
              }
            </div>

            <!-- Dynamic Template Forms -->
            @switch (qrTemplate()) {
              @case ('text') {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>文字或網址</mat-label>
                  <textarea matInput rows="4"
                    placeholder="輸入任意文字或 https://..."
                    [(ngModel)]="textContent"
                    (ngModelChange)="scheduleRender()">
                  </textarea>
                  <mat-hint>{{ textContent.length }} 字元</mat-hint>
                </mat-form-field>
              }
              @case ('url') {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>網址 (URL)</mat-label>
                  <input matInput type="url" placeholder="https://example.com"
                    [(ngModel)]="urlContent"
                    (ngModelChange)="scheduleRender()">
                  <mat-icon matPrefix>link</mat-icon>
                </mat-form-field>
              }
              @case ('wifi') {
                <div class="form-group">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Wi-Fi 名稱 (SSID)</mat-label>
                    <input matInput [(ngModel)]="wifi.ssid" (ngModelChange)="scheduleRender()">
                    <mat-icon matPrefix>wifi</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>密碼</mat-label>
                    <input matInput [type]="showWifiPwd ? 'text' : 'password'"
                      [(ngModel)]="wifi.password" (ngModelChange)="scheduleRender()">
                    <button mat-icon-button matSuffix (click)="showWifiPwd = !showWifiPwd">
                      <mat-icon>{{ showWifiPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>加密類型</mat-label>
                    <mat-select [(ngModel)]="wifi.encryption" (ngModelChange)="scheduleRender()">
                      <mat-option value="WPA">WPA/WPA2</mat-option>
                      <mat-option value="WEP">WEP</mat-option>
                      <mat-option value="nopass">無密碼</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="wifi.hidden" (ngModelChange)="scheduleRender()">
                    <span>隱藏 Wi-Fi 網路</span>
                  </label>
                </div>
              }
              @case ('vcard') {
                <div class="form-group">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>姓名</mat-label>
                    <input matInput [(ngModel)]="vcard.name" (ngModelChange)="scheduleRender()">
                    <mat-icon matPrefix>person</mat-icon>
                  </mat-form-field>
                  <div class="form-row">
                    <mat-form-field appearance="outline">
                      <mat-label>公司</mat-label>
                      <input matInput [(ngModel)]="vcard.org" (ngModelChange)="scheduleRender()">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>職稱</mat-label>
                      <input matInput [(ngModel)]="vcard.title" (ngModelChange)="scheduleRender()">
                    </mat-form-field>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>電話</mat-label>
                    <input matInput type="tel" [(ngModel)]="vcard.phone" (ngModelChange)="scheduleRender()">
                    <mat-icon matPrefix>phone</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>電子郵件</mat-label>
                    <input matInput type="email" [(ngModel)]="vcard.email" (ngModelChange)="scheduleRender()">
                    <mat-icon matPrefix>email</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>網站</mat-label>
                    <input matInput type="url" [(ngModel)]="vcard.url" (ngModelChange)="scheduleRender()">
                    <mat-icon matPrefix>language</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>地址</mat-label>
                    <input matInput [(ngModel)]="vcard.address" (ngModelChange)="scheduleRender()">
                    <mat-icon matPrefix>location_on</mat-icon>
                  </mat-form-field>
                </div>
              }
              @case ('email') {
                <div class="form-group">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>收件人</mat-label>
                    <input matInput type="email" [(ngModel)]="emailData.to" (ngModelChange)="scheduleRender()">
                    <mat-icon matPrefix>alternate_email</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>主旨</mat-label>
                    <input matInput [(ngModel)]="emailData.subject" (ngModelChange)="scheduleRender()">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>內容</mat-label>
                    <textarea matInput rows="3" [(ngModel)]="emailData.body" (ngModelChange)="scheduleRender()"></textarea>
                  </mat-form-field>
                </div>
              }
              @case ('sms') {
                <div class="form-group">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>電話號碼</mat-label>
                    <input matInput type="tel" [(ngModel)]="smsData.phone" (ngModelChange)="scheduleRender()">
                    <mat-icon matPrefix>sms</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>預設訊息</mat-label>
                    <textarea matInput rows="3" [(ngModel)]="smsData.message" (ngModelChange)="scheduleRender()"></textarea>
                  </mat-form-field>
                </div>
              }
            }

            <!-- QR Style Options -->
            <mat-accordion class="style-accordion">
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title><mat-icon>palette</mat-icon> 色彩樣式</mat-panel-title>
                </mat-expansion-panel-header>
                <div class="style-panel-content">
                  <div class="color-row">
                    <label class="color-label">
                      <span>前景色</span>
                      <div class="color-preview" [style.background]="fgColor"></div>
                      <input type="color" [(ngModel)]="fgColor" (ngModelChange)="scheduleRender()">
                    </label>
                    <label class="color-label">
                      <span>背景色</span>
                      <div class="color-preview" [style.background]="bgColor" style="border:1px solid var(--border-color)"></div>
                      <input type="color" [(ngModel)]="bgColor" (ngModelChange)="scheduleRender()">
                    </label>
                  </div>

                  <div class="toggle-row">
                    <span>啟用漸層前景</span>
                    <label class="toggle">
                      <input type="checkbox" [(ngModel)]="useGradient" (ngModelChange)="scheduleRender()">
                      <span class="slider"></span>
                    </label>
                  </div>

                  @if (useGradient) {
                    <div class="color-row">
                      <label class="color-label">
                        <span>漸層起始色</span>
                        <div class="color-preview" [style.background]="gradientStart"></div>
                        <input type="color" [(ngModel)]="gradientStart" (ngModelChange)="scheduleRender()">
                      </label>
                      <label class="color-label">
                        <span>漸層結束色</span>
                        <div class="color-preview" [style.background]="gradientEnd"></div>
                        <input type="color" [(ngModel)]="gradientEnd" (ngModelChange)="scheduleRender()">
                      </label>
                    </div>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>漸層方向</mat-label>
                      <mat-select [(ngModel)]="gradientDir" (ngModelChange)="scheduleRender()">
                        <mat-option value="to-bottom">由上而下</mat-option>
                        <mat-option value="to-right">由左而右</mat-option>
                        <mat-option value="diagonal">對角線</mat-option>
                      </mat-select>
                    </mat-form-field>
                  }

                  <div class="slider-row">
                    <span>容錯率等級</span>
                    <div class="ec-buttons">
                      @for (lvl of ecLevels; track lvl.value) {
                        <button class="ec-btn"
                          [class.active]="ecLevel() === lvl.value"
                          (click)="ecLevel.set(lvl.value); scheduleRender()"
                          [matTooltip]="lvl.desc">
                          {{ lvl.value }}
                        </button>
                      }
                    </div>
                  </div>

                  <div class="slider-row">
                    <span>安全邊距: {{ margin }}</span>
                    <input type="range" min="0" max="10" [(ngModel)]="margin" (ngModelChange)="scheduleRender()">
                  </div>
                </div>
              </mat-expansion-panel>

              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title><mat-icon>add_photo_alternate</mat-icon> 置入 Logo</mat-panel-title>
                </mat-expansion-panel-header>
                <div class="style-panel-content">
                  @if (!logoDataUrl()) {
                    <div class="logo-upload-area" (click)="logoFileInput.click()" (dragover)="$event.preventDefault()" (drop)="onLogoDrop($event)">
                      <mat-icon>upload_file</mat-icon>
                      <p>點擊或拖曳上傳 Logo（PNG / JPG）</p>
                      <p class="hint">建議使用有透明背景的 PNG</p>
                    </div>
                  } @else {
                    <div class="logo-preview-row">
                      <img [src]="logoDataUrl()" alt="Logo Preview" class="logo-thumb">
                      <button mat-icon-button color="warn" (click)="removeLogo()" matTooltip="移除 Logo">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  }
                  <input #logoFileInput type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none" (change)="onLogoFileChange($event)">

                  @if (logoDataUrl()) {
                    <div class="slider-row">
                      <span>Logo 大小: {{ logoSize }}%</span>
                      <input type="range" min="10" max="35" [(ngModel)]="logoSize" (ngModelChange)="scheduleRender()">
                    </div>
                    <div class="slider-row">
                      <span>白色避讓區: {{ logoPadding }}px</span>
                      <input type="range" min="0" max="20" [(ngModel)]="logoPadding" (ngModelChange)="scheduleRender()">
                    </div>
                  }
                </div>
              </mat-expansion-panel>
            </mat-accordion>
          }

          <!-- ── 2D Barcode Controls ── -->
          @if (barcodeMode() === '2d') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>條碼類型</mat-label>
              <mat-select [(ngModel)]="selected2DType" (ngModelChange)="scheduleRender()">
                @for (t of types2D; track t.value) {
                  <mat-option [value]="t.value">{{ t.label }}</mat-option>
                }
              </mat-select>
              <mat-icon matPrefix>view_module</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>條碼內容</mat-label>
              <textarea matInput rows="4"
                [(ngModel)]="barcodeContent2D"
                (ngModelChange)="scheduleRender()"
                placeholder="輸入要編碼的資料...">
              </textarea>
              <mat-hint>{{ barcodeContent2D.length }} 字元</mat-hint>
            </mat-form-field>
            <div class="info-chip">
              <mat-icon>info</mat-icon>
              <span>{{ get2DInfo(selected2DType) }}</span>
            </div>
          }

          <!-- ── 1D Barcode Controls ── -->
          @if (barcodeMode() === '1d') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>條碼類型</mat-label>
              <mat-select [(ngModel)]="selected1DType" (ngModelChange)="scheduleRender()">
                @for (t of types1D; track t.value) {
                  <mat-option [value]="t.value">{{ t.label }}</mat-option>
                }
              </mat-select>
              <mat-icon matPrefix>linear_scale</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>條碼內容</mat-label>
              <input matInput
                [(ngModel)]="barcodeContent1D"
                (ngModelChange)="scheduleRender()"
                [placeholder]="get1DPlaceholder(selected1DType)">
              <mat-hint>{{ get1DHint(selected1DType) }}</mat-hint>
            </mat-form-field>
            <div class="info-chip">
              <mat-icon>info</mat-icon>
              <span>{{ get1DInfo(selected1DType) }}</span>
            </div>

            <mat-accordion class="style-accordion">
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title><mat-icon>tune</mat-icon> 顯示設定</mat-panel-title>
                </mat-expansion-panel-header>
                <div class="style-panel-content">
                  <div class="toggle-row">
                    <span>顯示條碼文字</span>
                    <label class="toggle">
                      <input type="checkbox" [(ngModel)]="showBarcodeText" (ngModelChange)="scheduleRender()">
                      <span class="slider"></span>
                    </label>
                  </div>
                  <div class="slider-row">
                    <span>條碼高度: {{ barcodeHeight }}px</span>
                    <input type="range" min="40" max="200" [(ngModel)]="barcodeHeight" (ngModelChange)="scheduleRender()">
                  </div>
                </div>
              </mat-expansion-panel>
            </mat-accordion>
          }

        </div>

        <!-- ═══════════════ RIGHT: Preview ═══════════════ -->
        <div class="preview-panel">
          <div class="preview-sticky">
            <div class="preview-card" [class.has-error]="renderError()">

              <div class="preview-header">
                <span class="preview-label">即時預覽</span>
                @if (isRendering()) {
                  <span class="rendering-badge">
                    <mat-icon class="spin">refresh</mat-icon> 渲染中...
                  </span>
                }
              </div>

              <div class="canvas-wrapper" [style.background]="previewBg()">
                @if (renderError()) {
                  <div class="error-state">
                    <mat-icon>error_outline</mat-icon>
                    <p>{{ renderError() }}</p>
                  </div>
                }
                <!-- Canvas always in DOM so viewChild always resolves -->
                <canvas #barcodeCanvas class="barcode-canvas"
                  [class.hidden-canvas]="isEmpty() || renderError()">
                </canvas>
                @if (isEmpty() && !renderError()) {
                  <div class="empty-state">
                    <mat-icon>qr_code_2</mat-icon>
                    <p>請輸入內容以產生條碼</p>
                  </div>
                }
              </div>

              <!-- Export Actions -->
              <div class="export-actions">
                <button mat-flat-button color="primary" [disabled]="!canExport()" (click)="downloadPng()" matTooltip="下載高解析度 PNG">
                  <mat-icon>download</mat-icon> PNG
                </button>
                <button mat-stroked-button [disabled]="!canExport()" (click)="downloadSvg()" matTooltip="下載向量 SVG">
                  <mat-icon>crop_square</mat-icon> SVG
                </button>
                <button mat-icon-button [disabled]="!canExport()" (click)="copyImage()" matTooltip="複製圖片到剪貼簿">
                  <mat-icon>content_copy</mat-icon>
                </button>
                <button mat-icon-button [disabled]="!canExport()" (click)="printBarcode()" matTooltip="列印條碼">
                  <mat-icon>print</mat-icon>
                </button>
              </div>

              <!-- Scan Simulation -->
              @if (canExport() && barcodeMode() === 'qrcode') {
                <button mat-button class="scan-sim-btn" (click)="simulateScan()">
                  <mat-icon>document_scanner</mat-icon> 模擬掃描
                </button>
              }

              @if (scanResult()) {
                <div class="scan-result-bubble" (click)="scanResult.set('')">
                  <mat-icon>check_circle</mat-icon>
                  <div>
                    <div class="scan-result-label">掃描結果</div>
                    <div class="scan-result-value">{{ scanResult() }}</div>
                  </div>
                  <mat-icon class="close-icon">close</mat-icon>
                </div>
              }

            </div>

            <!-- Size Selector -->
            <div class="size-selector">
              <span class="size-label">匯出尺寸</span>
              @for (s of exportSizes; track s.value) {
                <button class="size-btn" [class.active]="exportSize() === s.value"
                  (click)="exportSize.set(s.value); scheduleRender()">
                  {{ s.label }}
                </button>
              }
            </div>
          </div>
        </div>

      </div>
    </app-tool-layout>

    <!-- Hidden print container -->
    <div id="print-container" style="display:none">
      <div id="print-content"></div>
    </div>
  `,
  styles: [`
    /* ── Layout ── */
    .generator-layout {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 32px;
      align-items: start;
      padding-bottom: 64px;
    }
    @media (max-width: 900px) {
      .generator-layout {
        grid-template-columns: 1fr;
      }
      .preview-sticky { position: static !important; }
    }

    /* ── Mode Selector ── */
    .mode-selector {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      background: color-mix(in srgb, currentColor 4%, transparent);
      padding: 6px;
      border-radius: 14px;
    }
    .mode-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 12px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 200ms ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .mode-btn:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
    .mode-btn.active {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    /* ── Template Chips ── */
    .template-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .template-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 14px;
      border-radius: 9999px;
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 0.8rem;
      font-family: inherit;
      transition: all 200ms ease;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .template-chip:hover {
      border-color: var(--mat-sys-primary);
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }
    .template-chip.active {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      border-color: transparent;
    }

    /* ── Forms ── */
    .full-width { width: 100%; margin-bottom: 4px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checkbox-label {
      display: flex; align-items: center; gap: 10px;
      font-size: 0.875rem; cursor: pointer; padding: 8px 4px;
      color: color-mix(in srgb, currentColor 70%, transparent);
    }

    /* ── Style Accordion ── */
    .style-accordion { margin-top: 16px; }
    .style-panel-content { display: flex; flex-direction: column; gap: 16px; }

    /* Color Pickers */
    .color-row { display: flex; gap: 16px; }
    .color-label {
      display: flex; flex-direction: column; align-items: center;
      gap: 6px; font-size: 0.75rem; cursor: pointer;
      color: color-mix(in srgb, currentColor 60%, transparent);
    }
    .color-preview {
      width: 40px; height: 40px; border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .color-label input[type=color] {
      width: 0; height: 0; opacity: 0; position: absolute;
    }

    /* Toggle */
    .toggle-row {
      display: flex; justify-content: space-between;
      align-items: center; font-size: 0.875rem;
    }
    .toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle .slider {
      position: absolute; cursor: pointer; inset: 0;
      background: color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 24px; transition: 0.3s;
    }
    .toggle .slider:before {
      position: absolute; content: '';
      height: 18px; width: 18px; left: 3px; bottom: 3px;
      background: white; border-radius: 50%; transition: 0.3s;
    }
    .toggle input:checked + .slider { background: var(--mat-sys-primary); }
    .toggle input:checked + .slider:before { transform: translateX(20px); }

    /* EC Level Buttons */
    .ec-buttons { display: flex; gap: 6px; }
    .ec-btn {
      width: 36px; height: 36px;
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 8px;
      background: transparent; color: inherit;
      cursor: pointer; font-weight: 700; font-size: 0.875rem;
      transition: all 200ms;
    }
    .ec-btn:hover { border-color: var(--mat-sys-primary); }
    .ec-btn.active {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      border-color: transparent;
    }

    /* Sliders */
    .slider-row {
      display: flex; flex-direction: column; gap: 6px;
      font-size: 0.875rem;
      color: color-mix(in srgb, currentColor 70%, transparent);
    }
    .slider-row input[type=range] {
      width: 100%; accent-color: var(--mat-sys-primary);
    }

    /* Logo Upload */
    .logo-upload-area {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 24px;
      border: 2px dashed color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 12px; cursor: pointer;
      transition: all 200ms;
      text-align: center;
      mat-icon { font-size: 36px; width: 36px; height: 36px; opacity: 0.4; }
      p { font-size: 0.875rem; opacity: 0.6; margin: 0; }
      p.hint { font-size: 0.75rem; opacity: 0.4; }
    }
    .logo-upload-area:hover {
      border-color: var(--mat-sys-primary);
      background: color-mix(in srgb, var(--mat-sys-primary) 5%, transparent);
    }
    .logo-preview-row {
      display: flex; align-items: center; gap: 12px;
    }
    .logo-thumb {
      width: 64px; height: 64px; border-radius: 8px;
      object-fit: contain;
      border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    }

    /* Info Chip */
    .info-chip {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 12px 16px;
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      border-radius: 10px;
      border-left: 3px solid var(--mat-sys-primary);
      font-size: 0.8rem;
      color: color-mix(in srgb, currentColor 70%, transparent);
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; color: var(--mat-sys-primary); }
    }

    /* ── Preview Panel ── */
    .preview-sticky {
      position: sticky;
      top: 96px;
    }
    .preview-card {
      background: color-mix(in srgb, currentColor 3%, transparent);
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 20px;
      padding: 20px;
      transition: border-color 300ms;
    }
    .preview-card.has-error {
      border-color: var(--mat-sys-error, #f44336);
    }
    .preview-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
    }
    .preview-label {
      font-size: 0.75rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.1em;
      opacity: 0.5;
    }
    .rendering-badge {
      display: flex; align-items: center; gap: 4px;
      font-size: 0.75rem; opacity: 0.6;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; display: inline-block; }

    /* Canvas visibility */
    .hidden-canvas { display: none !important; }

    .canvas-wrapper {
      display: flex; align-items: center; justify-content: center;
      min-height: 300px; border-radius: 12px;
      overflow: hidden; position: relative;
      transition: background 300ms;
    }
    .barcode-canvas {
      max-width: 100%; height: auto;
      display: block;
      border-radius: 8px;
      animation: fadeIn 250ms ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
    .empty-state, .error-state {
      display: flex; flex-direction: column;
      align-items: center; gap: 12px;
      opacity: 0.35; text-align: center; padding: 32px;
      mat-icon { font-size: 56px; width: 56px; height: 56px; }
      p { font-size: 0.875rem; }
    }
    .error-state { opacity: 1; color: var(--mat-sys-error, #f44336); }

    .export-actions {
      display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;
      button:first-child { flex: 1; }
    }
    .scan-sim-btn {
      width: 100%; margin-top: 8px;
      font-size: 0.8rem; opacity: 0.7;
    }
    .scan-sim-btn:hover { opacity: 1; }

    /* Scan Result Bubble */
    .scan-result-bubble {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px; margin-top: 12px;
      background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
      border: 1px solid var(--mat-sys-primary);
      border-radius: 12px; cursor: pointer;
      animation: slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
      mat-icon { flex-shrink: 0; color: var(--mat-sys-primary); }
      .close-icon { margin-left: auto; opacity: 0.4; font-size: 18px; width: 18px; height: 18px; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .scan-result-label { font-size: 0.7rem; opacity: 0.6; margin-bottom: 2px; }
    .scan-result-value {
      font-size: 0.85rem; font-weight: 500;
      word-break: break-all;
      max-height: 60px; overflow-y: auto;
    }

    /* Size Selector */
    .size-selector {
      display: flex; align-items: center; gap: 8px;
      margin-top: 12px; flex-wrap: wrap;
    }
    .size-label { font-size: 0.75rem; opacity: 0.5; flex-shrink: 0; }
    .size-btn {
      padding: 4px 10px;
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 6px; background: transparent; color: inherit;
      cursor: pointer; font-size: 0.78rem; font-family: inherit;
      transition: all 200ms;
    }
    .size-btn:hover { border-color: var(--mat-sys-primary); }
    .size-btn.active {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      border-color: transparent;
    }

    /* Mat Accordion overrides */
    ::ng-deep .style-accordion .mat-expansion-panel {
      background: transparent !important;
      box-shadow: none !important;
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent) !important;
      border-radius: 10px !important;
      margin-bottom: 8px;
    }
    ::ng-deep .style-accordion .mat-expansion-panel-header {
      mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 8px; }
    }
  `],
})
export class BarcodeGeneratorComponent {
  private snackBar = inject(MatSnackBar);

  // ── Signals ──
  barcodeMode = signal<BarcodeMode>('qrcode');
  qrTemplate = signal<QrTemplate>('url');
  ecLevel = signal<EcLevel>('M');
  exportSize = signal<number>(512);
  isRendering = signal(false);
  renderError = signal('');
  isEmpty = signal(true);
  logoDataUrl = signal('');
  scanResult = signal('');

  // ── QR Content ──
  textContent = '';
  urlContent = 'https://';
  wifi: WifiData = { ssid: '', password: '', encryption: 'WPA', hidden: false };
  vcard: VcardData = { name: '', org: '', title: '', phone: '', email: '', url: '', address: '' };
  emailData: EmailData = { to: '', subject: '', body: '' };
  smsData: SmsData = { phone: '', message: '' };
  showWifiPwd = false;

  // ── QR Style ──
  fgColor = '#000000';
  bgColor = '#ffffff';
  useGradient = false;
  gradientStart = '#6c63ff';
  gradientEnd = '#a78bfa';
  gradientDir: GradientDir = 'diagonal';
  margin = 4;
  logoSize = 20;
  logoPadding = 8;

  // ── 2D & 1D ──
  selected2DType: BarcodeType2D = 'datamatrix';
  barcodeContent2D = '';
  selected1DType: BarcodeType1D = 'code128';
  barcodeContent1D = '';
  showBarcodeText = true;
  barcodeHeight = 80;

  // ── Canvas refs ──
  barcodeCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('barcodeCanvas');

  // ── Computed ──
  canExport = computed(() => !this.isEmpty() && !this.renderError() && !this.isRendering());
  previewBg = computed(() => {
    if (this.barcodeMode() === 'qrcode' && !this.renderError() && !this.isEmpty()) {
      return this.bgColor;
    }
    return 'transparent';
  });

  // ── Static Data ──
  modes = [
    { value: 'qrcode' as BarcodeMode, label: 'QR Code', icon: 'qr_code_2' },
    { value: '2d' as BarcodeMode, label: '二維條碼', icon: 'grid_view' },
    { value: '1d' as BarcodeMode, label: '一維條碼', icon: 'linear_scale' },
  ];

  qrTemplates = [
    { value: 'url' as QrTemplate, label: '網址', icon: 'link' },
    { value: 'text' as QrTemplate, label: '文字', icon: 'text_fields' },
    { value: 'wifi' as QrTemplate, label: 'Wi-Fi', icon: 'wifi' },
    { value: 'vcard' as QrTemplate, label: '聯絡人', icon: 'contact_page' },
    { value: 'email' as QrTemplate, label: '電子郵件', icon: 'email' },
    { value: 'sms' as QrTemplate, label: '簡訊', icon: 'sms' },
  ];

  ecLevels = [
    { value: 'L' as EcLevel, desc: 'L (7%) — 最小容錯，資料量最大' },
    { value: 'M' as EcLevel, desc: 'M (15%) — 標準容錯（建議）' },
    { value: 'Q' as EcLevel, desc: 'Q (25%) — 高容錯，適合印刷' },
    { value: 'H' as EcLevel, desc: 'H (30%) — 最高容錯，適合置入 Logo' },
  ];

  types2D = [
    { value: 'datamatrix' as BarcodeType2D, label: 'Data Matrix' },
    { value: 'pdf417' as BarcodeType2D, label: 'PDF417' },
    { value: 'azteccode' as BarcodeType2D, label: 'Aztec Code' },
  ];

  types1D = [
    { value: 'code128' as BarcodeType1D, label: 'Code 128 (通用英數)' },
    { value: 'code39' as BarcodeType1D, label: 'Code 39' },
    { value: 'ean13' as BarcodeType1D, label: 'EAN-13 (零售)' },
    { value: 'upca' as BarcodeType1D, label: 'UPC-A' },
  ];

  exportSizes = [
    { value: 256, label: '256px' },
    { value: 512, label: '512px' },
    { value: 1024, label: '1024px' },
    { value: 2048, label: '2K' },
  ];

  private renderTimer: any = null;
  private bwipLoaded = false;

  constructor() {
    afterNextRender(() => {
      this.loadBwipJs();
      this.scheduleRender();
    });
  }

  // ── Template & Mode Switching ──
  switchMode(mode: BarcodeMode) {
    this.barcodeMode.set(mode);
    this.scanResult.set('');
    this.isEmpty.set(true);
    this.renderError.set('');
    this.scheduleRender();
  }

  setTemplate(t: QrTemplate) {
    this.qrTemplate.set(t);
    this.scanResult.set('');
    this.scheduleRender();
  }

  // ── Render Scheduling ──
  scheduleRender() {
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.render(), 120);
  }

  async render() {
    const mode = this.barcodeMode();
    if (mode === 'qrcode') {
      await this.renderQrCode();
    } else {
      await this.renderBwip();
    }
  }

  // ── QR Code Rendering ──
  async renderQrCode() {
    const data = this.getQrData();
    if (!data || data.trim() === '' || data === 'https://') {
      this.isEmpty.set(true);
      this.renderError.set('');
      return;
    }

    this.isRendering.set(true);
    this.renderError.set('');

    try {
      // Dynamically import qrcode
      const QRCodeLib = await import('qrcode');
      const size = this.exportSize();
      const margin = this.margin;

      // First generate the raw QR matrix canvas
      const tempCanvas = document.createElement('canvas');
      await QRCodeLib.toCanvas(tempCanvas, data, {
        width: size,
        margin: margin,
        errorCorrectionLevel: this.ecLevel(),
        color: {
          dark: this.useGradient ? '#000000' : this.fgColor,
          light: this.bgColor,
        },
      });

      // Apply gradient if needed
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = size;
      finalCanvas.height = size;
      const ctx = finalCanvas.getContext('2d')!;

      if (this.useGradient) {
        // Draw white bg first
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, size, size);

        // Draw QR pattern in black on temp canvas, then apply gradient mask
        ctx.drawImage(tempCanvas, 0, 0);

        // Create gradient overlay using 'source-in' to colorize dark pixels
        const grad = this.createGradient(ctx, size);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = 'source-over';

        // Draw bg behind everything
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = size;
        bgCanvas.height = size;
        const bgCtx = bgCanvas.getContext('2d')!;
        bgCtx.fillStyle = this.bgColor;
        bgCtx.fillRect(0, 0, size, size);
        bgCtx.drawImage(finalCanvas, 0, 0);
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(bgCanvas, 0, 0);
      } else {
        ctx.drawImage(tempCanvas, 0, 0);
      }

      // Draw logo if present
      if (this.logoDataUrl()) {
        await this.drawLogo(ctx, size);
      }

      // Render onto finalCanvas first
      // Then copy to the display canvas (which is always in DOM)
      this.isEmpty.set(false);
      // Allow Angular to render the canvas in DOM before drawing
      await new Promise(r => setTimeout(r, 0));

      const displayCanvas = this.barcodeCanvasRef()?.nativeElement;
      if (!displayCanvas) {
        this.isEmpty.set(true);
        return;
      }
      displayCanvas.width = size;
      displayCanvas.height = size;
      const dCtx = displayCanvas.getContext('2d')!;
      dCtx.drawImage(finalCanvas, 0, 0);
    } catch (e: any) {
      this.renderError.set(e?.message || '產生 QR Code 時發生錯誤，請確認輸入內容。');
      this.isEmpty.set(true);
    } finally {
      this.isRendering.set(false);
    }
  }

  private createGradient(ctx: CanvasRenderingContext2D, size: number): CanvasGradient {
    let grad: CanvasGradient;
    switch (this.gradientDir) {
      case 'to-right':
        grad = ctx.createLinearGradient(0, 0, size, 0);
        break;
      case 'diagonal':
        grad = ctx.createLinearGradient(0, 0, size, size);
        break;
      default: // to-bottom
        grad = ctx.createLinearGradient(0, 0, 0, size);
    }
    grad.addColorStop(0, this.gradientStart);
    grad.addColorStop(1, this.gradientEnd);
    return grad;
  }

  private async drawLogo(ctx: CanvasRenderingContext2D, size: number): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const logoW = size * (this.logoSize / 100);
        const logoH = logoW;
        const x = (size - logoW) / 2;
        const y = (size - logoH) / 2;
        const pad = this.logoPadding;

        // White clear zone
        ctx.fillStyle = this.bgColor;
        ctx.beginPath();
        ctx.roundRect(x - pad, y - pad, logoW + pad * 2, logoH + pad * 2, 8);
        ctx.fill();

        // Draw logo
        ctx.drawImage(img, x, y, logoW, logoH);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = this.logoDataUrl();
    });
  }

  // ── bwip-js Rendering ──
  private async loadBwipJs() {
    if (this.bwipLoaded || (window as any).bwipjs) {
      this.bwipLoaded = true;
      return;
    }
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/bwip-js@4/dist/bwip-js-min.js';
      script.onload = () => { this.bwipLoaded = true; };
      document.head.appendChild(script);
    } catch (e) {
      console.warn('bwip-js load failed', e);
    }
  }

  async renderBwip() {
    const mode = this.barcodeMode();
    const content = mode === '2d' ? this.barcodeContent2D : this.barcodeContent1D;
    const btype = mode === '2d' ? this.selected2DType : this.selected1DType;

    if (!content?.trim()) {
      this.isEmpty.set(true);
      this.renderError.set('');
      return;
    }

    this.isRendering.set(true);
    this.renderError.set('');

    // Wait for bwip-js to load (max 5s)
    let waited = 0;
    while (!(window as any).bwipjs && waited < 5000) {
      await new Promise(r => setTimeout(r, 200));
      waited += 200;
    }

    if (!(window as any).bwipjs) {
      this.renderError.set('條碼渲染庫尚未載入，請稍後再試或檢查網路連線。');
      this.isRendering.set(false);
      return;
    }

    try {
      // Set isEmpty false so the canvas element appears in the DOM
      this.isEmpty.set(false);
      this.renderError.set('');
      // Wait one tick for Angular to render canvas into the DOM
      await new Promise(r => setTimeout(r, 0));

      const canvas = this.barcodeCanvasRef()?.nativeElement;
      if (!canvas) {
        this.isEmpty.set(true);
        this.isRendering.set(false);
        return;
      }

      const bwipjs = (window as any).bwipjs;
      const opts: any = {
        bcid: btype,
        text: content,
        scale: 3,
        includetext: mode === '1d' && this.showBarcodeText,
      };

      if (mode === '1d') {
        opts.height = this.barcodeHeight / 10;
      }

      bwipjs.toCanvas(canvas, opts);
    } catch (e: any) {
      const msg = e?.message || String(e);
      this.renderError.set('條碼格式錯誤：' + msg.substring(0, 80));
      this.isEmpty.set(true);
    } finally {
      this.isRendering.set(false);
    }
  }

  // ── QR Data Builder ──
  getQrData(): string {
    switch (this.qrTemplate()) {
      case 'text': return this.textContent;
      case 'url': return this.urlContent;
      case 'wifi': {
        const w = this.wifi;
        if (!w.ssid) return '';
        const pwd = w.encryption === 'nopass' ? '' : w.password;
        const hidden = w.hidden ? ';H:true' : '';
        return `WIFI:T:${w.encryption};S:${this.escapeWifi(w.ssid)};P:${this.escapeWifi(pwd)}${hidden};;`;
      }
      case 'vcard': {
        const v = this.vcard;
        if (!v.name && !v.phone && !v.email) return '';
        const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
        if (v.name) lines.push(`FN:${v.name}`);
        if (v.org) lines.push(`ORG:${v.org}`);
        if (v.title) lines.push(`TITLE:${v.title}`);
        if (v.phone) lines.push(`TEL:${v.phone}`);
        if (v.email) lines.push(`EMAIL:${v.email}`);
        if (v.url) lines.push(`URL:${v.url}`);
        if (v.address) lines.push(`ADR:;;${v.address};;;;`);
        lines.push('END:VCARD');
        return lines.join('\n');
      }
      case 'email': {
        const e = this.emailData;
        if (!e.to) return '';
        const params = [];
        if (e.subject) params.push(`subject=${encodeURIComponent(e.subject)}`);
        if (e.body) params.push(`body=${encodeURIComponent(e.body)}`);
        return `mailto:${e.to}${params.length ? '?' + params.join('&') : ''}`;
      }
      case 'sms': {
        const s = this.smsData;
        if (!s.phone) return '';
        return `sms:${s.phone}${s.message ? `?body=${encodeURIComponent(s.message)}` : ''}`;
      }
      default: return '';
    }
  }

  private escapeWifi(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/"/g, '\\"');
  }

  // ── Logo Upload ──
  onLogoFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.readFileAsDataUrl(file);
  }

  onLogoDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFileAsDataUrl(file);
  }

  private readFileAsDataUrl(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoDataUrl.set(e.target?.result as string);
      this.scheduleRender();
    };
    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.logoDataUrl.set('');
    this.scheduleRender();
  }

  // ── Export Functions ──
  downloadPng() {
    const canvas = this.barcodeCanvasRef()?.nativeElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `barcode-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    this.snackBar.open('✅ PNG 已下載', '', { duration: 2000 });
  }

  downloadSvg() {
    const canvas = this.barcodeCanvasRef()?.nativeElement;
    if (!canvas) return;

    if (this.barcodeMode() === 'qrcode') {
      // For QR code, embed canvas as base64 in SVG
      const size = canvas.width;
      const dataUrl = canvas.toDataURL('image/png');
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <image width="${size}" height="${size}" xlink:href="${dataUrl}"/>
</svg>`;
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = `qrcode-${Date.now()}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
    } else {
      // For bwip-js, try to get SVG directly
      const bwipjs = (window as any).bwipjs;
      const mode = this.barcodeMode();
      const content = mode === '2d' ? this.barcodeContent2D : this.barcodeContent1D;
      const btype = mode === '2d' ? this.selected2DType : this.selected1DType;
      try {
        const svgStr = bwipjs.toSVG({
          bcid: btype,
          text: content,
          scale: 3,
          includetext: mode === '1d' && this.showBarcodeText,
        });
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.download = `barcode-${Date.now()}.svg`;
        link.href = URL.createObjectURL(blob);
        link.click();
      } catch {
        // Fallback to PNG embedded SVG
        this.downloadPng();
        return;
      }
    }
    this.snackBar.open('✅ SVG 已下載', '', { duration: 2000 });
  }

  async copyImage() {
    const canvas = this.barcodeCanvasRef()?.nativeElement;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        this.snackBar.open('✅ 圖片已複製到剪貼簿', '', { duration: 2000 });
      }, 'image/png');
    } catch {
      this.snackBar.open('❌ 複製失敗，請使用下載功能', '', { duration: 3000 });
    }
  }

  printBarcode() {
    const canvas = this.barcodeCanvasRef()?.nativeElement;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank', 'width=400,height=500');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html>
      <head><title>列印條碼</title>
      <style>
        body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: white; }
        img { max-width: 90vw; max-height: 90vh; }
        @media print { body { margin: 20px; } }
      </style>
      </head>
      <body>
        <img src="${dataUrl}" alt="barcode" onload="window.print(); window.close();">
      </body></html>
    `);
    win.document.close();
  }

  // ── Simulate Scan ──
  simulateScan() {
    const data = this.getQrData();
    if (data) {
      this.scanResult.set(data.length > 120 ? data.substring(0, 120) + '…' : data);
    }
  }

  // ── Helper Info ──
  get2DInfo(type: BarcodeType2D): string {
    const map: Record<BarcodeType2D, string> = {
      datamatrix: 'Data Matrix：超高密度二維碼，常用於工業零件、晶片與小型藥品包裝標籤。',
      pdf417: 'PDF417：堆疊式條碼，可儲存大量文字資料，廣泛用於駕照、登機證與身分證件。',
      azteccode: 'Aztec Code：高效能二維碼，無需靜態邊框，常見於鐵路與航空電子票證。',
    };
    return map[type];
  }

  get1DInfo(type: BarcodeType1D): string {
    const map: Record<BarcodeType1D, string> = {
      code128: 'Code 128：支援完整 ASCII 字元集，是最通用的工業物流條碼格式。',
      code39: 'Code 39：支援大寫英數字，自我檢核碼設計，適合資產管理與醫療識別。',
      ean13: 'EAN-13：零售商品國際標準條碼，需填入 12 或 13 位數字。',
      upca: 'UPC-A：北美零售標準條碼，需填入 11 或 12 位數字。',
      qr: 'QR Code',
    };
    return map[type];
  }

  get1DPlaceholder(type: BarcodeType1D): string {
    const map: Record<BarcodeType1D, string> = {
      code128: '例如: ABC-1234567',
      code39: '例如: HELLO WORLD',
      ean13: '例如: 4901234567890',
      upca: '例如: 012345678905',
      qr: '',
    };
    return map[type];
  }

  get1DHint(type: BarcodeType1D): string {
    const map: Record<BarcodeType1D, string> = {
      code128: '支援英數字及特殊符號',
      code39: '僅支援大寫英文、數字與部分符號',
      ean13: '請輸入 12 位數字（檢核碼自動計算）',
      upca: '請輸入 11 位數字（檢核碼自動計算）',
      qr: '',
    };
    return map[type];
  }
}
