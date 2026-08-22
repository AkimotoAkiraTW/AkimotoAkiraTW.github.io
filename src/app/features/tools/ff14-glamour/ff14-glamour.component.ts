import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CapturePanelComponent } from '../../../shared/components/capture-panel/capture-panel.component';
import { ToolLayoutComponent } from '../tool-layout.component';
import { DyePaletteComponent } from './dye-palette.component';
import {
  DEFAULT_OVERLAY_STYLE,
  GLAMOUR_SLOTS,
  SLOT_GROUPS,
  defaultOverlay,
  displayName,
  emptyDyes,
  emptyPins,
  hexToRgba,
  relocateToolbarDrop,
  stainName,
  type GearItem,
  type LodestoneLang,
  type OverlayCard,
  type SlotGroup,
  type SlotId,
  type Stain,
} from './ff14-glamour.model';
import { fetchItemsByIds, searchSlotItems, xivIconUrl } from './xivapi';
import { loadStains } from './stains';
import { clearLookImage, loadLookImage, saveLookImage } from './look-image';
import {
  ensureFanKit,
  lodestoneItemUrl,
  lodestoneSearchUrl,
  parseLodestoneItemRef,
} from './lodestone';
import { buildShareQuery, buildShareUrl, parseShareFromUrl } from './ff14-glamour.share';

type Widget = {
  slot: SlotId;
  mode: 'add' | 'edit';
  x: number;
  y: number;
  dropX: number;
  dropY: number;
};

type OverlayPart = 'icon' | 'name' | 'dye';

@Component({
  selector: 'app-ff14-glamour',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    CapturePanelComponent,
    DyePaletteComponent,
    ToolLayoutComponent,
  ],
  template: `
    <app-tool-layout heading="FF14 搭配附圖" [fullWidth]="true">
      <button
        header-extra
        #helpTrigger
        type="button"
        class="help-link"
        [attr.aria-expanded]="pageHelpOpen()"
        aria-haspopup="dialog"
        (click)="openPageHelp()"
      >
        操作說明
      </button>
      @if (shareNeedsImage()) {
        <p class="share-banner">
          裝備、染色與卡片位置已從連結還原。請再上傳截圖，卡片會回到記錄的位置。圖片無法放進網址。
        </p>
      }

      <app-capture-panel filenamePrefix="ff14-glamour" [enabled]="!!imageUrl()" [hug]="!!imageUrl()">
        <div extra class="capture-tools" (pointerdown)="$event.stopPropagation()">
          <div class="capture-actions">
            @if (imageUrl()) {
              <button mat-stroked-button type="button" (click)="clearImage()">
                <mat-icon>hide_image</mat-icon>
                清除圖片
              </button>
            } @else {
              <button mat-stroked-button type="button" (click)="fileInput.click()">
                <mat-icon>add_photo_alternate</mat-icon>
                上傳圖片
              </button>
            }
            <button mat-stroked-button type="button" (click)="openInsertFromBar($event)">
              <mat-icon>add</mat-icon>
              加入裝備
              @if (pinList().length) {
                <span class="add-count">{{ pinList().length }}</span>
              }
            </button>
            <div class="segmented-control" role="group" aria-label="官方語系">
              <button type="button" [class.active]="lang() === 'ja'" (click)="setLang('ja')">日</button>
              <button type="button" [class.active]="lang() === 'en'" (click)="setLang('en')">英</button>
            </div>
            <button mat-stroked-button type="button" [disabled]="!hasPins()" (click)="copyShareUrl()">
              <mat-icon>share</mat-icon>
              複製連結
            </button>
          </div>
        </div>

        <div
          #lookCanvas
          class="look-canvas"
          [class.is-empty]="!imageUrl()"
          [class.dragover]="fileDragOver() || gearDragOver()"
          (dragover)="onStageDragOver($event)"
          (dragleave)="onStageDragLeave($event)"
          (drop)="onStageDrop($event)"
          (contextmenu)="onCanvasMenu($event)"
        >
          @if (imageUrl()) {
            <img class="look-photo" [src]="imageUrl()" alt="角色截圖" draggable="false" />
          }
          @if (gearDragOver()) {
            <div class="drop-hint no-capture">放到這裡</div>
          }
          @for (card of overlays(); track card.slot) {
            @if (pins()[card.slot]; as item) {
              @if (card.showIcon && item.iconPath) {
                <div
                  class="ov-part ov-icon"
                  [attr.data-slot]="card.slot"
                  data-part="icon"
                  [class.is-editing]="editingSlot() === card.slot"
                  [style.left.%]="card.x"
                  [style.top.%]="card.y"
                  draggable="false"
                  (pointerdown)="onPartPointerDown($event, card.slot, 'icon')"
                >
                  @if (item.lodestoneHash) {
                    <a
                      class="eorzeadb_link ov-icon-link"
                      [href]="officialUrl(item)"
                      target="_blank"
                      rel="noopener noreferrer"
                      draggable="false"
                      (click)="$event.preventDefault()"
                    >
                      <img
                        [src]="iconUrl(item.iconPath)"
                        [alt]="nameOf(item)"
                        crossorigin="anonymous"
                        draggable="false"
                        [style.width.px]="card.iconSize"
                        [style.height.px]="card.iconSize"
                      />
                    </a>
                  } @else {
                    <img
                      [src]="iconUrl(item.iconPath)"
                      [alt]="nameOf(item)"
                      crossorigin="anonymous"
                      draggable="false"
                      [style.width.px]="card.iconSize"
                      [style.height.px]="card.iconSize"
                    />
                  }
                </div>
              }
              @if (card.showName) {
                <div
                  class="ov-part ov-label"
                  [attr.data-slot]="card.slot"
                  data-part="name"
                  [class.is-editing]="editingSlot() === card.slot"
                  [style.left.%]="card.nameX"
                  [style.top.%]="card.nameY"
                  [style.font-size.px]="card.fontSize"
                  [style.color]="card.textColor"
                  [style.background]="partBg(card, 'name')"
                  [style.border]="partBorder(card, 'name')"
                  draggable="false"
                  (pointerdown)="onPartPointerDown($event, card.slot, 'name')"
                >
                  <strong>{{ nameOf(item) }}</strong>
                </div>
              }
              @if (card.showDye) {
                <div
                  class="ov-part ov-label"
                  [attr.data-slot]="card.slot"
                  data-part="dye"
                  [class.is-editing]="editingSlot() === card.slot"
                  [style.left.%]="card.dyeX"
                  [style.top.%]="card.dyeY"
                  [style.font-size.px]="card.dyeFontSize"
                  [style.color]="card.dyeColor"
                  [style.background]="partBg(card, 'dye')"
                  [style.border]="partBorder(card, 'dye')"
                  draggable="false"
                  (pointerdown)="onPartPointerDown($event, card.slot, 'dye')"
                >
                  @for (stain of dyesFor(card.slot); track stain.id) {
                    <span class="overlay-dye">
                      <i [style.background]="stain.hex"></i>
                      {{ stainLabel(stain) }}
                    </span>
                  }
                </div>
              }
            }
          }
        </div>
      </app-capture-panel>
      <input #fileInput type="file" accept="image/*" hidden (change)="onFileInput($event)" />

      @if (widget(); as w) {
        <div
          #floatWidget
          class="float-widget no-capture"
          [style.left.px]="w.x"
          [style.top.px]="w.y"
          [style.max-height.px]="widgetMaxHeight(w.y)"
          (pointerdown)="$event.stopPropagation()"
        >
          <header class="widget-head" (pointerdown)="startWidgetMove($event)">
            <strong>{{ w.mode === 'add' ? '加入裝備' : '調整裝備' }}</strong>
            @if (pinList().length) {
              <span class="widget-count">{{ pinList().length }}</span>
            }
            <span class="widget-tools">
              <button
                type="button"
                mat-icon-button
                aria-label="加入裝備"
                matTooltip="搜尋並加入裝備"
                [class.active-tool]="w.mode === 'add'"
                (click)="startAdd()"
                (pointerdown)="$event.stopPropagation()"
              >
                <mat-icon>add</mat-icon>
              </button>
              <button
                type="button"
                mat-icon-button
                [attr.aria-label]="cardOf(w.slot)?.linked ? '此件綁定移動' : '此件無綁定'"
                [matTooltip]="cardOf(w.slot)?.linked ? '此件綁定中：圖示、名稱、染色一起拖' : '此件無綁定：可分開拖'"
                [disabled]="!cardOf(w.slot)"
                (click)="toggleLink(w.slot)"
                (pointerdown)="$event.stopPropagation()"
              >
                <mat-icon>{{ cardOf(w.slot)?.linked ? 'link' : 'link_off' }}</mat-icon>
              </button>
              <button
                type="button"
                mat-icon-button
                aria-label="對齊圖示"
                matTooltip="對齊圖示：名稱右上、染料右下"
                [disabled]="w.mode !== 'edit' || !cardOf(w.slot)"
                (click)="alignLabels(w.slot)"
                (pointerdown)="$event.stopPropagation()"
              >
                <mat-icon>align_horizontal_left</mat-icon>
              </button>
              <button
                type="button"
                mat-icon-button
                aria-label="操作說明"
                matTooltip="操作說明"
                [class.active-tool]="helpOpen()"
                (click)="helpOpen.set(!helpOpen())"
                (pointerdown)="$event.stopPropagation()"
              >
                <mat-icon>info_outline</mat-icon>
              </button>
              <button
                type="button"
                mat-icon-button
                class="danger-icon"
                aria-label="刪除這件裝備"
                matTooltip="刪除這件裝備"
                [disabled]="w.mode !== 'edit' || !pins()[w.slot]"
                (click)="unpin(w.slot)"
                (pointerdown)="$event.stopPropagation()"
              >
                <mat-icon>remove</mat-icon>
              </button>
              <button
                type="button"
                mat-icon-button
                aria-label="關閉"
                (click)="closeWidget()"
                (pointerdown)="$event.stopPropagation()"
              >
                <mat-icon>close</mat-icon>
              </button>
            </span>
          </header>
          @if (helpOpen()) {
            <p class="help-pop">{{ widgetHelp }}</p>
          }

          <div class="widget-body">
            @if (pinList().length) {
              <div class="pin-icons">
                @for (row of pinList(); track row.slot) {
                  <button
                    type="button"
                    class="pin-chip"
                    [class.active]="w.mode === 'edit' && w.slot === row.slot"
                    [class.on-canvas]="!!cardOf(row.slot)"
                    draggable="true"
                    (dragstart)="onPinDragStart($event, row.slot)"
                    (click)="selectPin(row.slot)"
                  >
                    @if (row.item.iconPath) {
                      <img [src]="iconUrl(row.item.iconPath)" [alt]="nameOf(row.item)" width="28" height="28" />
                    }
                    <span class="pin-meta">
                      <span class="pin-copy">
                        <small>{{ row.label }}</small>
                        <strong>{{ nameOf(row.item) }}</strong>
                      </span>
                      @if (dyesFor(row.slot).length) {
                        <span class="pin-dyes">
                          @for (stain of dyesFor(row.slot); track stain.id) {
                            <i [style.background]="stain.hex" [title]="stainLabel(stain)"></i>
                          }
                        </span>
                      }
                    </span>
                  </button>
                }
              </div>
            }

            @if (w.mode === 'edit' && pins()[w.slot]; as item) {
              <p class="inspector-name">
                {{ slotLabel(w.slot) }} ·
                <a
                  class="item-name"
                  [href]="officialUrl(item)"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ nameOf(item) }}</a>
              </p>

              @if (item.dyeCount > 0) {
                @for (channel of dyeChannels(item.dyeCount); track channel) {
                  <div class="dye-row">
                    <span>染色 {{ channel }}</span>
                    <button type="button" class="dye-swatch" (click)="openDyePicker(w.slot, channel)">
                      @if (stainAt(w.slot, channel); as stain) {
                        <i [style.background]="stain.hex"></i>
                        {{ stainLabel(stain) }}
                      } @else {
                        未染色 · 開色盤
                      }
                    </button>
                  </div>
                  @if (dyePicker()?.slot === w.slot && dyePicker()?.channel === channel) {
                    <app-dye-palette
                      [stains]="stains()"
                      [lang]="lang()"
                      [selectedId]="dyes()[w.slot][channel - 1]"
                      (pick)="chooseDye(w.slot, channel, $event)"
                    />
                  }
                }
              }

              <label class="hash-row">
                <span>官方代號</span>
                <input
                  type="text"
                  [value]="item.lodestoneHash ?? ''"
                  placeholder="代號或官方網址"
                  (change)="onHashInput(w.slot, $event)"
                />
              </label>

              @if (cardOf(w.slot); as card) {
                <div class="inspector-toggles">
                  <label><input type="checkbox" [checked]="card.showIcon" (change)="patchOverlay(card.slot, { showIcon: checkbox($event) })" /> 圖示</label>
                  <label><input type="checkbox" [checked]="card.showName" (change)="patchOverlay(card.slot, { showName: checkbox($event) })" /> 名稱</label>
                  <label><input type="checkbox" [checked]="card.showDye" (change)="patchOverlay(card.slot, { showDye: checkbox($event) })" /> 染色</label>
                </div>
                <label class="slider-row">圖示大小
                  <input type="range" min="20" max="72" [ngModel]="card.iconSize" (ngModelChange)="patchOverlay(card.slot, { iconSize: +$event })" />
                </label>
                <p class="widget-sub">裝備文字</p>
                <label class="slider-row">大小
                  <input type="range" min="10" max="28" [ngModel]="card.fontSize" (ngModelChange)="patchOverlay(card.slot, { fontSize: +$event })" />
                </label>
                <label class="color-row">顏色
                  <input type="color" [ngModel]="card.textColor" (ngModelChange)="patchOverlay(card.slot, { textColor: $event })" />
                </label>
                <label class="toggle-row">
                  <input type="checkbox" [checked]="card.nameShowBg" (change)="patchOverlay(card.slot, { nameShowBg: checkbox($event) })" />
                  名稱背景
                </label>
                <p class="widget-sub">染料文字</p>
                <label class="slider-row">大小
                  <input type="range" min="10" max="28" [ngModel]="card.dyeFontSize" (ngModelChange)="patchOverlay(card.slot, { dyeFontSize: +$event })" />
                </label>
                <label class="color-row">顏色
                  <input type="color" [ngModel]="card.dyeColor" (ngModelChange)="patchOverlay(card.slot, { dyeColor: $event })" />
                </label>
                <label class="toggle-row">
                  <input type="checkbox" [checked]="card.dyeShowBg" (change)="patchOverlay(card.slot, { dyeShowBg: checkbox($event) })" />
                  染料背景
                </label>
                <p class="widget-sub">底色與框線（關掉背景就不擋圖）</p>
                <label class="color-row">背景
                  <input type="color" [ngModel]="card.bgColor" (ngModelChange)="patchOverlay(card.slot, { bgColor: $event })" />
                </label>
                <label class="slider-row">透明度
                  <input type="range" min="0" max="95" [ngModel]="card.bgAlpha * 100" (ngModelChange)="patchOverlay(card.slot, { bgAlpha: +$event / 100 })" />
                </label>
                <label class="color-row">框線
                  <input type="color" [ngModel]="card.borderColor" (ngModelChange)="patchOverlay(card.slot, { borderColor: $event })" />
                </label>
                <label class="slider-row">框線粗細
                  <input type="range" min="0" max="8" [ngModel]="card.borderWidth" (ngModelChange)="patchOverlay(card.slot, { borderWidth: +$event })" />
                </label>
              } @else if (imageUrl()) {
                <button mat-stroked-button type="button" (click)="placeOnCanvas(w.slot)">
                  <mat-icon>place</mat-icon> 放到圖上
                </button>
              }
            }

            @if (w.mode === 'add') {
              <p class="widget-sub">搜尋裝備</p>
              <div class="segmented-control group-tabs">
                @for (group of groups; track group.id) {
                  <button type="button" [class.active]="insertGroup() === group.id" (click)="setInsertGroup(group.id)">
                    {{ group.label }}
                  </button>
                }
              </div>
              <div class="insert-slots">
                @for (slot of insertSlots(); track slot.id) {
                  <button
                    type="button"
                    [class.active]="insertSlot() === slot.id"
                    (click)="setInsertSlot(slot.id)"
                  >{{ slot.label }}</button>
                }
              </div>
              <label class="search-row">
                <mat-icon>search</mat-icon>
                <input
                  type="search"
                  [ngModel]="insertQuery()"
                  (ngModelChange)="onInsertQuery($event)"
                  placeholder="搜尋此部位（日文或英文）"
                />
              </label>
              @if (insertError()) { <p class="slot-error">{{ insertError() }}</p> }
              @if (insertResults().length) {
                <ul class="results">
                  @for (hit of insertResults(); track hit.id) {
                    <li>
                      <button type="button" class="result-btn" (click)="pickFromWidget(hit)">
                        @if (hit.iconPath) {
                          <img class="gear-icon" [src]="iconUrl(hit.iconPath)" [alt]="nameOf(hit)" width="32" height="32" />
                        }
                        <span class="result-text">
                          <strong>{{ nameOf(hit) }}</strong>
                          <small>{{ hit.category }}</small>
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              } @else if (insertSearching()) {
                <p class="slot-hint">搜尋中…</p>
              }
            }
          </div>
        </div>
      }

      <aside class="legal">
        <p class="legal-mark">© SQUARE ENIX</p>
        <p>
          FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.
          本工具非官方，與 Square Enix 無關。
        </p>
        <p>
          裝備名稱、圖示與染料色值為遊戲內著作物；官方條目連至 Lodestone／Fan Kit。
          即時查詢經由社群
          <a href="https://v2.xivapi.com/" target="_blank" rel="noopener noreferrer">XIVAPI</a>
          （Item／Stain），資料與素材之著作權仍屬 Square Enix。本工具不鏡像裝備表。
        </p>
        <p>
          <a href="https://support.jp.square-enix.com/rule.php?id=5381&amp;la=0" target="_blank" rel="noopener noreferrer">著作物利用條件</a>
          ·
          <a href="https://support.na.square-enix.com/rule.php?id=5382" target="_blank" rel="noopener noreferrer">Materials Usage License</a>
          。轉貼搭配圖時請保留 © SQUARE ENIX。
        </p>
      </aside>
    </app-tool-layout>

    @if (pageHelpOpen()) {
      <div class="help-backdrop no-capture" (click)="closePageHelp()">
        <div
          class="help-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="page-help-title"
          (click)="$event.stopPropagation()"
          (pointerdown)="$event.stopPropagation()"
        >
          <header class="help-panel-head">
            <h2 id="page-help-title">操作說明</h2>
            <button
              #helpCloseBtn
              type="button"
              class="help-close"
              aria-label="關閉"
              (click)="closePageHelp()"
            >
              <mat-icon>close</mat-icon>
            </button>
          </header>
          <div class="help-panel-body">
            <section>
              <h3>圖上</h3>
              <ul>
                <li>左鍵長按圖示、名稱或染色可拖曳。</li>
                <li>右鍵點圖示或文字：調整該件。</li>
                <li>右鍵點空白處：加入裝備。</li>
                <li>也可把調整面板裡已加入的裝備拖到圖上。</li>
              </ul>
            </section>
            <section>
              <h3>工具列</h3>
              <ul class="help-actions">
                <li>
                  <span class="help-icons" aria-hidden="true">
                    <mat-icon>add_photo_alternate</mat-icon>
                    <mat-icon>hide_image</mat-icon>
                  </span>
                  <span>上傳或清除；也可把圖片拖到圖上。</span>
                </li>
                <li>
                  <span class="help-icons" aria-hidden="true"><mat-icon>add</mat-icon></span>
                  <span>加入裝備。</span>
                </li>
                <li>
                  <span class="help-icons" aria-hidden="true">
                    <span class="help-seg" aria-hidden="true"><span>日</span><span>英</span></span>
                  </span>
                  <span>切換裝備資訊。</span>
                </li>
                <li>
                  <span class="help-icons" aria-hidden="true"><mat-icon>share</mat-icon></span>
                  <span>分享搭配資訊（不含截圖）。</span>
                </li>
                <li>
                  <span class="help-pair">
                    <span class="help-icons" aria-hidden="true"><mat-icon>photo_camera</mat-icon></span>
                    <span>複製到剪貼簿。</span>
                  </span>
                  <span class="help-pair">
                    <span class="help-icons" aria-hidden="true"><mat-icon>download</mat-icon></span>
                    <span>存成 PNG。</span>
                  </span>
                </li>
              </ul>
            </section>
            <section>
              <h3>調整面板</h3>
              <ul class="help-actions">
                <li>
                  <span class="help-icons" aria-hidden="true"><mat-icon>add</mat-icon></span>
                  <span>搜尋並加入裝備。</span>
                </li>
                <li>
                  <span class="help-icons" aria-hidden="true"><mat-icon>link</mat-icon></span>
                  <span>此件圖示、名稱與染色一起拖。斷開後可分開拖；再綁定會對齊回圖示旁。每件各自設定，新增預設為綁定。</span>
                </li>
                <li>
                  <span class="help-icons" aria-hidden="true"><mat-icon>align_horizontal_left</mat-icon></span>
                  <span>名稱在圖示右上、染色在右下。</span>
                </li>
                <li>
                  <span class="help-icons" aria-hidden="true"><mat-icon>remove</mat-icon></span>
                  <span>移除此件裝備。</span>
                </li>
                <li>官方代號：填了之後，滑過圖上圖示可看 Fan Kit。</li>
              </ul>
            </section>
            <p class="help-legal">轉貼搭配圖時請保留 © SQUARE ENIX。</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .help-link {
      appearance: none;
      display: inline-block;
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--accent-color);
      cursor: pointer;
    }
    .help-link:hover { text-decoration: underline; }
    .help-link:focus-visible {
      outline: 2px solid var(--accent-color);
      outline-offset: 3px;
      border-radius: 2px;
    }
    .help-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 16px;
      padding-top: max(16px, 6vh);
      overflow: auto;
      background: rgba(15, 23, 42, 0.45);
    }
    .help-panel {
      width: min(36rem, 100%);
      max-height: min(88vh, 40rem);
      display: flex;
      flex-direction: column;
      background: var(--surface-color);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
    }
    .help-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      flex-shrink: 0;
      padding: 16px 12px 12px 20px;
      border-bottom: 1px solid var(--border-color);
    }
    .help-panel-head h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .help-close {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .help-close:hover { background: var(--surface-alt); color: var(--text-primary); }
    .help-close mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .help-panel-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
      padding: 4px 20px 22px;
    }
    .help-panel-body section + section { margin-top: 1.15em; }
    .help-panel-body h3 {
      margin: 0.85em 0 0.45em;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }
    .help-panel-body section:first-child h3 { margin-top: 0.7em; }
    .help-panel-body ul {
      margin: 0;
      padding-left: 1.15em;
    }
    .help-panel-body li {
      margin: 0 0 0.4em;
      font-size: 0.9rem;
      line-height: 1.6;
      color: var(--text-secondary);
    }
    .help-panel-body li:last-child { margin-bottom: 0; }
    .help-actions {
      padding-left: 0;
      list-style: none;
    }
    .help-actions li {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 6px 8px;
    }
    .help-pair {
      display: inline-flex;
      align-items: flex-start;
      gap: 8px;
    }
    .help-actions li > span:not(.help-icons):not(.help-pair),
    .help-pair > span:last-child {
      flex: 1 1 10rem;
      min-width: 0;
    }
    .help-icons {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      flex: 0 0 auto;
      min-width: 20px;
      height: 1.6em;
      color: var(--text-muted);
    }
    .help-actions mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .help-seg {
      display: inline-flex;
      align-items: stretch;
      overflow: hidden;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
    }
    .help-seg span { padding: 3px 5px; }
    .help-seg span + span { border-left: 1px solid var(--border-color); }
    .help-legal {
      margin: 1.25em 0 0;
      padding-top: 0.9em;
      border-top: 1px solid var(--border-color);
      font-size: 0.8rem;
      line-height: 1.55;
      color: var(--text-muted);
    }
    .share-banner {
      margin: 0 0 var(--space-lg);
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      background: var(--state-info-soft);
      color: var(--text-secondary);
      font-size: 13px;
    }
    .capture-tools {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
    .capture-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    .add-count {
      min-width: 18px;
      padding: 0 5px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-color);
      font-size: 12px;
      font-weight: 700;
      line-height: 18px;
      text-align: center;
    }
    .pin-icons { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
    .pin-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border-color);
      background: var(--surface-alt);
      color: inherit;
      border-radius: 10px;
      padding: 4px;
      font-size: 12px;
      cursor: pointer;
      text-align: left;
    }
    .pin-chip.on-canvas { border-color: var(--accent-color); }
    .pin-chip.active { outline: 1px solid var(--accent-color); }
    .pin-chip img { border-radius: 4px; pointer-events: none; }
    .pin-meta, .pin-copy, .pin-dyes { display: none; }
    .pin-chip:hover .pin-meta,
    .pin-chip:focus-visible .pin-meta,
    .pin-chip.active .pin-meta { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
    .pin-chip:hover .pin-copy,
    .pin-chip:focus-visible .pin-copy,
    .pin-chip.active .pin-copy { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
    .pin-chip:hover .pin-dyes,
    .pin-chip:focus-visible .pin-dyes,
    .pin-chip.active .pin-dyes { display: inline-flex; gap: 3px; }
    .pin-copy small { color: var(--text-muted); font-size: 10px; }
    .pin-copy strong { font-size: 12px; font-weight: 600; }
    .pin-dyes i {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      border: 1px solid rgba(255,255,255,0.35);
    }

    .look-canvas.dragover { outline: 2px dashed var(--accent-color); outline-offset: -8px; }

    .look-canvas {
      position: relative;
      width: fit-content;
      max-width: 100%;
      margin-inline: auto;
      background: var(--surface-alt);
      overflow: hidden;
    }
    .look-canvas.is-empty {
      width: 100%;
      aspect-ratio: 16 / 9;
      min-height: 360px;
    }
    .look-canvas.is-empty .ov-part { outline: 1px dashed var(--accent-color); }
    .look-photo {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 80vh;
      object-fit: fill;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
    }
    .look-canvas.is-capturing {
      margin-inline: 0;
    }
    .drop-hint {
      position: absolute;
      inset: 12px;
      border: 2px dashed var(--accent-color);
      color: var(--accent-color);
      display: grid;
      place-items: center;
      font-weight: 700;
      background: var(--accent-softer);
      pointer-events: none;
    }
    .ov-part {
      position: absolute;
      cursor: grab;
      user-select: none;
      touch-action: none;
      max-width: 42%;
      z-index: 2;
    }
    .ov-part.is-dragging { cursor: grabbing; z-index: 4; }
    .ov-part.is-editing { outline: 1px solid var(--accent-color); outline-offset: 2px; }
    :host ::ng-deep .is-capturing .ov-part.is-editing { outline: none; }
    .ov-icon { padding: 0; line-height: 0; }
    .ov-icon-link {
      display: block;
      line-height: 0;
      cursor: grab;
    }
    .ov-icon img {
      display: block;
      border-radius: 4px;
      pointer-events: none;
      -webkit-user-drag: none;
    }
    .ov-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 6px;
      border-radius: 6px;
    }
    .ov-label strong { line-height: 1.25; word-break: break-word; }
    .overlay-dye { display: inline-flex; align-items: center; gap: 4px; }
    .overlay-dye i, .dye-swatch i {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      border: 1px solid rgba(255,255,255,0.35);
      display: inline-block;
    }

    .float-widget {
      position: fixed;
      z-index: 1100;
      display: flex;
      flex-direction: column;
      width: min(340px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      overflow: hidden;
      padding: 8px 10px 0;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--surface-color);
      color: var(--text-primary);
      box-shadow: var(--shadow-lg);
    }
    .widget-head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      flex-shrink: 0;
      cursor: grab;
      user-select: none;
      padding: 2px 0 6px;
    }
    .widget-head strong { flex: 0 0 auto; }
    .widget-count {
      min-width: 18px;
      padding: 0 5px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-color);
      font-size: 12px;
      font-weight: 700;
      line-height: 18px;
      text-align: center;
    }
    .widget-tools {
      margin-left: auto;
      display: flex;
      align-items: center;
    }
    .widget-tools button { width: 32px; height: 32px; padding: 0; }
    .widget-tools mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .widget-tools .active-tool { color: var(--accent-color); }
    .danger-icon { color: var(--state-danger); }
    .help-pop {
      flex-shrink: 0;
      margin: 0 0 10px;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background: var(--surface-alt);
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.55;
      white-space: pre-line;
    }
    .widget-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
      padding: 0 2px 12px;
    }
    .widget-sub { font-size: 12px; color: var(--text-muted); margin: 14px 0 10px; }
    .inspector-name { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }
    .inspector-toggles, .toggle-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
      margin: 12px 0 10px;
    }
    .inspector-toggles label, .toggle-row { font-size: 13px; }
    .toggle-row { margin: 0 0 8px; }
    .slider-row, .color-row {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: var(--space-sm);
      align-items: center;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .color-row input[type='color'] { width: 100%; height: 28px; border: 0; background: none; padding: 0; }
    .insert-slots { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .insert-slots button {
      border: 1px solid var(--border-color);
      background: var(--surface-alt);
      color: inherit;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .insert-slots button.active { border-color: var(--accent-color); color: var(--accent-color); }
    .group-tabs { width: 100%; margin-bottom: var(--space-md); }
    .group-tabs button { flex: 1; }
    .item-name { font-weight: 700; color: var(--accent-color); text-decoration: none; }
    .item-name:hover { text-decoration: underline; }
    .gear-icon { border-radius: var(--radius-sm); background: var(--surface-alt); flex-shrink: 0; }

    .dye-row, .hash-row, .search-row {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin-top: var(--space-sm);
    }
    .dye-row span, .hash-row span { font-size: 12px; color: var(--text-muted); flex-shrink: 0; }
    .dye-swatch, .hash-row input, .search-row input {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--border-color);
      background: var(--surface-alt);
      color: var(--text-primary);
      border-radius: var(--radius-sm);
      padding: 8px 10px;
      font-size: 13px;
    }
    .dye-swatch { display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; }
    .search-row mat-icon { color: var(--text-muted); font-size: 20px; }

    .results { list-style: none; margin: var(--space-sm) 0 0; display: flex; flex-direction: column; gap: 4px; }
    .result-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      text-align: left;
      border: 1px solid transparent;
      background: var(--surface-alt);
      border-radius: var(--radius-sm);
      padding: 6px 8px;
      cursor: pointer;
      color: inherit;
    }
    .result-btn:hover { border-color: var(--accent-color); }
    .result-text { display: flex; flex-direction: column; min-width: 0; }
    .result-text strong { font-size: 13px; }
    .result-text small { color: var(--text-muted); }
    .slot-hint, .slot-error { margin-top: var(--space-sm); font-size: 13px; }
    .slot-error { color: var(--state-danger); }
    .legal { margin-top: var(--space-3xl); font-size: 12px; color: var(--text-muted); line-height: 1.6; }
    .legal p { margin: 0 0 0.6em; }
    .legal p:last-child { margin-bottom: 0; }
    .legal-mark { font-weight: 600; letter-spacing: 0.02em; color: var(--text-secondary); }
    .legal a { color: var(--accent-color); }
  `],
})
export class Ff14GlamourComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clipboard = inject(Clipboard);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly lookCanvas = viewChild<ElementRef<HTMLElement>>('lookCanvas');
  private readonly widgetEl = viewChild<ElementRef<HTMLElement>>('floatWidget');
  private readonly helpTrigger = viewChild<ElementRef<HTMLButtonElement>>('helpTrigger');
  private readonly helpCloseBtn = viewChild<ElementRef<HTMLButtonElement>>('helpCloseBtn');
  private readonly injector = inject(Injector);
  readonly widgetHelp =
    '左鍵長按：拖曳圖上的圖示或文字。\n右鍵：點在圖示或文字上可調整該件；點空白處則加入裝備。\n每件可各自綁定。新增預設綁定，圖示、名稱與染色一起拖；斷開後可分開拖，再綁定會對齊回圖示旁。\n填了官方代號後，滑過圖上圖示可看 Fan Kit。\n＋：切換搜尋加入。';

  readonly groups = SLOT_GROUPS;
  readonly lang = signal<LodestoneLang>('ja');
  readonly pins = signal(emptyPins());
  readonly dyes = signal(emptyDyes());
  readonly overlays = signal<OverlayCard[]>([]);
  readonly stains = signal<Stain[]>([]);
  readonly dyePicker = signal<{ slot: SlotId; channel: 1 | 2 } | null>(null);
  readonly imageUrl = signal<string | null>(null);
  readonly fileDragOver = signal(false);
  readonly gearDragOver = signal(false);
  readonly widget = signal<Widget | null>(null);
  readonly helpOpen = signal(false);
  readonly pageHelpOpen = signal(false);
  readonly shareNeedsImage = signal(false);
  readonly insertGroup = signal<SlotGroup>('armor');
  readonly insertSlot = signal<SlotId>('body');
  readonly insertQuery = signal('');
  readonly insertResults = signal<GearItem[]>([]);
  readonly insertSearching = signal(false);
  readonly insertError = signal<string | null>(null);

  readonly insertSlots = computed(() =>
    GLAMOUR_SLOTS.filter((slot) => slot.group === this.insertGroup()),
  );
  readonly hasPins = computed(() =>
    GLAMOUR_SLOTS.some((slot) => this.pins()[slot.id] !== null),
  );
  readonly pinList = computed(() =>
    GLAMOUR_SLOTS.flatMap((def) => {
      const item = this.pins()[def.id];
      return item ? [{ slot: def.id, label: def.label, item }] : [];
    }),
  );
  readonly editingSlot = computed(() => {
    const current = this.widget();
    return current?.mode === 'edit' && this.pins()[current.slot] ? current.slot : null;
  });

  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly aborts = new Map<string, AbortController>();
  private objectUrl: string | null = null;
  private dragging = false;
  private urlTimer: ReturnType<typeof setTimeout> | null = null;
  private bodyOverflow = '';

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokeImage();
      this.unlockPage();
      if (this.urlTimer) clearTimeout(this.urlTimer);
      for (const timer of this.timers.values()) clearTimeout(timer);
      for (const abort of this.aborts.values()) abort.abort();
    });
    if (this.isBrowser) {
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        if (this.pageHelpOpen()) {
          event.preventDefault();
          this.closePageHelp();
          return;
        }
        this.closeWidget();
      };
      const onPointer = (event: PointerEvent) => {
        if (event.button === 2) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('.float-widget, .help-backdrop, .help-link')) return;
        this.closeWidget();
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('pointerdown', onPointer);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerdown', onPointer);
      });
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      ensureFanKit();
      void this.ensureStains();
    }
    const shared = parseShareFromUrl(
      `?${new URLSearchParams(this.route.snapshot.queryParams as Record<string, string>)}`,
    );
    if (shared) this.lang.set(shared.lang);
    if (this.isBrowser) {
      void this.hydrateLook(shared);
    } else if (shared) {
      void this.restoreShare(shared);
    }
  }

  setLang(lang: LodestoneLang): void {
    this.lang.set(lang);
    this.syncUrl();
  }

  nameOf(item: GearItem): string {
    return displayName(item, this.lang());
  }

  stainLabel(stain: Stain): string {
    return stainName(stain, this.lang());
  }

  iconUrl(path: string): string {
    return xivIconUrl(path);
  }

  slotLabel(slot: SlotId): string {
    return GLAMOUR_SLOTS.find((def) => def.id === slot)?.label ?? slot;
  }

  officialUrl(item: GearItem): string {
    if (item.lodestoneHash) return lodestoneItemUrl(this.lang(), item.lodestoneHash);
    return lodestoneSearchUrl(this.lang(), this.nameOf(item));
  }

  cardOf(slot: SlotId): OverlayCard | null {
    return this.overlays().find((card) => card.slot === slot) ?? null;
  }

  partBg(card: OverlayCard, part: 'name' | 'dye'): string {
    const show = part === 'name' ? card.nameShowBg : card.dyeShowBg;
    if (!show || card.bgAlpha <= 0) return 'transparent';
    return hexToRgba(card.bgColor, card.bgAlpha);
  }

  partBorder(card: OverlayCard, part: 'name' | 'dye'): string {
    const show = part === 'name' ? card.nameShowBg : card.dyeShowBg;
    if (!show || card.borderWidth <= 0) return '0 solid transparent';
    return `${card.borderWidth}px solid ${hexToRgba(card.borderColor, card.borderAlpha)}`;
  }

  dyeChannels(count: number): Array<1 | 2> {
    return count >= 2 ? [1, 2] : [1];
  }

  stainAt(slot: SlotId, channel: 1 | 2): Stain | null {
    const id = this.dyes()[slot][channel - 1];
    if (!id) return null;
    return this.stains().find((stain) => stain.id === id) ?? null;
  }

  dyesFor(slot: SlotId): Stain[] {
    return [this.stainAt(slot, 1), this.stainAt(slot, 2)].filter((stain): stain is Stain => stain !== null);
  }

  checkbox(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  closeWidget(): void {
    this.widget.set(null);
    this.dyePicker.set(null);
    this.helpOpen.set(false);
  }

  openPageHelp(): void {
    if (this.pageHelpOpen()) return;
    this.pageHelpOpen.set(true);
    this.lockPage();
    afterNextRender(() => this.helpCloseBtn()?.nativeElement.focus(), { injector: this.injector });
  }

  closePageHelp(): void {
    if (!this.pageHelpOpen()) return;
    this.pageHelpOpen.set(false);
    this.unlockPage();
    afterNextRender(() => this.helpTrigger()?.nativeElement.focus(), { injector: this.injector });
  }

  startAdd(): void {
    this.resetInsertSearch();
    this.dyePicker.set(null);
    const drop = this.dropAtTopCenter();
    this.widget.update((current) =>
      current
        ? { ...current, mode: 'add', slot: this.insertSlot(), dropX: drop.x, dropY: drop.y }
        : current,
    );
    afterNextRender(() => this.fitWidget(), { injector: this.injector });
  }

  toggleLink(slot: SlotId): void {
    const card = this.cardOf(slot);
    if (!card) return;
    const next = !card.linked;
    this.patchOverlay(slot, { linked: next });
    if (next) this.alignLabels(slot);
  }

  openInsertFromBar(event: MouseEvent): void {
    this.resetInsertSearch();
    const drop = this.dropAtTopCenter();
    this.openWidget({
      mode: 'add',
      slot: this.insertSlot(),
      dropX: drop.x,
      dropY: drop.y,
      ...this.placeWidgetNear(event.clientX, event.clientY),
    });
  }

  selectPin(slot: SlotId): void {
    this.prepareSlotSearch(slot);
    this.widget.update((current) => (current ? { ...current, slot, mode: 'edit' } : current));
    afterNextRender(() => this.fitWidget(), { injector: this.injector });
  }

  onInsertQuery(value: string): void {
    this.insertQuery.set(value);
    this.scheduleSearch(() => this.search(this.insertSlot(), value));
  }

  setInsertGroup(group: SlotGroup): void {
    this.insertGroup.set(group);
    const first = GLAMOUR_SLOTS.find((slot) => slot.group === group);
    if (first) this.setInsertSlot(first.id);
  }

  setInsertSlot(slot: SlotId): void {
    this.insertSlot.set(slot);
    this.widget.update((current) => (current ? { ...current, slot } : current));
    const q = this.insertQuery();
    if (q.trim().length >= 2) this.scheduleSearch(() => this.search(slot, q));
  }

  onHashInput(slot: SlotId, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const hash = parseLodestoneItemRef(value);
    if (hash) {
      this.attachHash(slot, hash);
      return;
    }
    if (!value.trim()) this.attachHash(slot, undefined);
    else this.snack.open('請貼官方代號、單頁網址或 [db:item=…]', '關閉', { duration: 2800 });
  }

  pin(slot: SlotId, item: GearItem): void {
    const current = this.pins()[slot];
    const merged =
      current?.id === item.id && current.lodestoneHash
        ? { ...item, lodestoneHash: current.lodestoneHash }
        : item;
    this.pins.update((pins) => ({ ...pins, [slot]: merged }));
    if (current?.id !== item.id) {
      this.dyes.update((dyes) => ({ ...dyes, [slot]: [0, 0] }));
    }
    this.syncUrl();
    if (merged.dyeCount > 0) void this.ensureStains();
  }

  unpin(slot: SlotId): void {
    this.pins.update((pins) => ({ ...pins, [slot]: null }));
    this.dyes.update((dyes) => ({ ...dyes, [slot]: [0, 0] }));
    this.removeOverlay(slot);
    this.widget.update((current) =>
      current?.slot === slot ? { ...current, mode: 'add', slot: this.insertSlot() } : current,
    );
    this.syncUrl();
    afterNextRender(() => this.fitWidget(), { injector: this.injector });
  }

  async openDyePicker(slot: SlotId, channel: 1 | 2): Promise<void> {
    await this.ensureStains();
    const current = this.dyePicker();
    if (current?.slot === slot && current.channel === channel) {
      this.dyePicker.set(null);
      return;
    }
    this.dyePicker.set({ slot, channel });
    afterNextRender(() => {
      document.querySelector('app-dye-palette')?.scrollIntoView({ block: 'nearest' });
    }, { injector: this.injector });
  }

  chooseDye(slot: SlotId, channel: 1 | 2, stainId: number): void {
    this.dyes.update((dyes) => {
      const next: [number, number] = [...dyes[slot]];
      next[channel - 1] = stainId;
      return { ...dyes, [slot]: next };
    });
    this.syncUrl();
  }

  onPinDragStart(event: DragEvent, slot: SlotId): void {
    event.dataTransfer?.setData('text/ff14-slot', slot);
    event.dataTransfer?.setData('text/plain', slot);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  onStageDragOver(event: DragEvent): void {
    const types = [...(event.dataTransfer?.types ?? [])];
    if (types.includes('Files')) {
      event.preventDefault();
      this.fileDragOver.set(true);
      return;
    }
    this.onCanvasDragOver(event);
  }

  onStageDragLeave(event: DragEvent): void {
    const canvas = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (next && canvas.contains(next)) return;
    const box = canvas.getBoundingClientRect();
    if (
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    ) {
      return;
    }
    this.fileDragOver.set(false);
    this.gearDragOver.set(false);
  }

  onStageDrop(event: DragEvent): void {
    event.preventDefault();
    this.fileDragOver.set(false);
    this.gearDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.setImage(file);
      return;
    }
    this.onCanvasDrop(event);
  }

  onCanvasDragOver(event: DragEvent): void {
    const types = [...(event.dataTransfer?.types ?? [])];
    if (types.includes('Files') && !types.includes('text/plain')) return;
    event.preventDefault();
    this.gearDragOver.set(true);
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    this.gearDragOver.set(false);
    const slot = event.dataTransfer?.getData('text/ff14-slot') || event.dataTransfer?.getData('text/plain');
    if (!slot || !this.pins()[slot as SlotId]) return;
    const point = this.eventPercent(event);
    if (!point) return;
    this.upsertOverlay(slot as SlotId, point);
  }

  onCanvasMenu(event: MouseEvent): void {
    event.preventDefault();
    const overlay = (event.target as HTMLElement | null)?.closest('.ov-part');
    const slot = overlay?.getAttribute('data-slot') as SlotId | null;
    if (slot && this.pins()[slot]) {
      this.prepareSlotSearch(slot);
      this.openWidget({
        mode: 'edit',
        slot,
        dropX: 8,
        dropY: 8,
        ...this.placeWidgetNear(event.clientX, event.clientY),
      });
      return;
    }
    this.resetInsertSearch();
    const point = this.dropAtClick(event);
    this.openWidget({
      mode: 'add',
      slot: this.insertSlot(),
      dropX: point.x,
      dropY: point.y,
      ...this.placeWidgetNear(event.clientX, event.clientY),
    });
  }

  pickFromWidget(item: GearItem): void {
    const current = this.widget();
    if (!current) return;
    const slot = this.insertSlot();
    const existed = !!this.pins()[slot];
    this.pin(slot, item);
    if (!existed) this.upsertOverlay(slot, { x: current.dropX, y: current.dropY });
    this.resetInsertSearch();
    this.widget.update((w) => (w ? { ...w, slot, mode: 'edit' } : w));
    afterNextRender(() => this.fitWidget(), { injector: this.injector });
    if (!this.imageUrl()) {
      this.shareNeedsImage.set(true);
      this.snack.open('已加入。上傳截圖後，卡片會出現在圖上。', '關閉', { duration: 2800 });
    }
  }

  placeOnCanvas(slot: SlotId): void {
    if (!this.imageUrl()) {
      this.snack.open('先上傳截圖再放到圖上', '關閉', { duration: 2400 });
      return;
    }
    this.upsertOverlay(slot, this.dropAtTopCenter());
  }

  onPartPointerDown(event: PointerEvent, slot: SlotId, part: OverlayPart): void {
    if (event.button !== 0) return;
    this.startMove(event, slot, part, event.currentTarget as HTMLElement);
  }

  startMove(event: PointerEvent, slot: SlotId, part: OverlayPart, el: HTMLElement): void {
    if (event.button !== 0 || this.dragging) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = this.lookCanvas()?.nativeElement;
    const card = this.cardOf(slot);
    if (!canvas || !card) return;
    const origin = this.partOrigin(card, part);
    const rect = canvas.getBoundingClientRect();
    const grabX = ((event.clientX - rect.left) / rect.width) * 100 - origin.x;
    const grabY = ((event.clientY - rect.top) / rect.height) * 100 - origin.y;
    const iconEl = canvas.querySelector(`[data-slot="${slot}"][data-part="icon"]`) as HTMLElement | null;
    const nameEl = canvas.querySelector(`[data-slot="${slot}"][data-part="name"]`) as HTMLElement | null;
    const dyeEl = canvas.querySelector(`[data-slot="${slot}"][data-part="dye"]`) as HTMLElement | null;
    this.dragging = true;
    el.classList.add('is-dragging');
    el.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    let x = origin.x;
    let y = origin.y;
    let moved = false;
    const linked = card.linked;

    const applyLinked = (nextX: number, nextY: number) => {
      const dx = nextX - origin.x;
      const dy = nextY - origin.y;
      const iconX = this.clampOnCanvas(card.x + dx, iconEl, 'x', rect);
      const iconY = this.clampOnCanvas(card.y + dy, iconEl, 'y', rect);
      const nameX = this.clampOnCanvas(card.nameX + dx, nameEl, 'x', rect);
      const nameY = this.clampOnCanvas(card.nameY + dy, nameEl, 'y', rect);
      const dyeX = this.clampOnCanvas(card.dyeX + dx, dyeEl, 'x', rect);
      const dyeY = this.clampOnCanvas(card.dyeY + dy, dyeEl, 'y', rect);
      if (iconEl) {
        iconEl.style.left = `${iconX}%`;
        iconEl.style.top = `${iconY}%`;
      }
      if (nameEl) {
        nameEl.style.left = `${nameX}%`;
        nameEl.style.top = `${nameY}%`;
      }
      if (dyeEl) {
        dyeEl.style.left = `${dyeX}%`;
        dyeEl.style.top = `${dyeY}%`;
      }
      return { x: iconX, y: iconY, nameX, nameY, dyeX, dyeY };
    };

    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
      moved = true;
      x = this.clampOnCanvas(((e.clientX - rect.left) / rect.width) * 100 - grabX, el, 'x', rect);
      y = this.clampOnCanvas(((e.clientY - rect.top) / rect.height) * 100 - grabY, el, 'y', rect);
      if (linked) {
        applyLinked(x, y);
      } else {
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
      }
    };
    const up = () => {
      this.dragging = false;
      el.classList.remove('is-dragging');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      if (moved) {
        this.patchOverlay(slot, linked ? applyLinked(x, y) : this.partPatch(part, x, y));
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  startWidgetMove(event: PointerEvent): void {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest('button')) return;
    event.preventDefault();
    const current = this.widget();
    const el = (event.currentTarget as HTMLElement | null)?.closest('.float-widget') as HTMLElement | null;
    if (!current || !el) return;
    const grabX = event.clientX - current.x;
    const grabY = event.clientY - current.y;
    let x = current.x;
    let y = current.y;
    const move = (e: PointerEvent) => {
      const next = this.clampWidgetBox(e.clientX - grabX, e.clientY - grabY, el.offsetWidth, el.offsetHeight);
      x = next.x;
      y = next.y;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.maxHeight = `${this.widgetMaxHeight(y)}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.widget.update((w) => (w ? { ...w, x, y } : w));
      el.style.left = '';
      el.style.top = '';
      el.style.maxHeight = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  patchOverlay(slot: SlotId, patch: Partial<OverlayCard>): void {
    this.overlays.update((cards) =>
      cards.map((card) => (card.slot === slot ? { ...card, ...patch } : card)),
    );
    this.syncUrl();
  }

  alignLabels(slot: SlotId): void {
    const card = this.cardOf(slot);
    const canvas = this.lookCanvas()?.nativeElement;
    if (!card || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const iconEl = canvas.querySelector(`[data-slot="${slot}"][data-part="icon"]`) as HTMLElement | null;
    const nameEl = canvas.querySelector(`[data-slot="${slot}"][data-part="name"]`) as HTMLElement | null;
    const dyeEl = canvas.querySelector(`[data-slot="${slot}"][data-part="dye"]`) as HTMLElement | null;
    const iconW = iconEl?.offsetWidth || card.iconSize;
    const nameH = nameEl?.offsetHeight || card.fontSize + 8;
    const gapX = (6 / rect.width) * 100;
    const gapY = (4 / rect.height) * 100;
    const nameX = this.clampOnCanvas(card.x + (iconW / rect.width) * 100 + gapX, nameEl, 'x', rect);
    const nameY = this.clampOnCanvas(card.y, nameEl, 'y', rect);
    const dyeX = nameX;
    const dyeY = this.clampOnCanvas(card.y + (nameH / rect.height) * 100 + gapY, dyeEl, 'y', rect);
    this.patchOverlay(slot, { nameX, nameY, dyeX, dyeY });
  }

  removeOverlay(slot: SlotId): void {
    this.overlays.update((cards) => cards.filter((card) => card.slot !== slot));
    this.syncUrl();
  }

  widgetMaxHeight(y: number): number {
    return Math.max(180, window.innerHeight - y - 8);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setImage(file);
    input.value = '';
  }

  onFileDragOver(event: DragEvent): void {
    event.preventDefault();
    this.fileDragOver.set(true);
  }

  onFileDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.fileDragOver.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.fileDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) this.setImage(file);
  }

  clearImage(): void {
    this.revokeImage();
    this.imageUrl.set(null);
    if (this.overlays().length) this.shareNeedsImage.set(true);
    void clearLookImage().catch(() => undefined);
  }

  copyShareUrl(): void {
    const url = buildShareUrl(this.toShareState(), this.router.url.split('?')[0]);
    const ok = this.clipboard.copy(url);
    this.snack.open(
      ok ? '已複製連結（含裝備、染色、卡片位置與樣式；不含截圖）' : '複製失敗',
      '關閉',
      { duration: 3200 },
    );
  }

  private lockPage(): void {
    if (!this.isBrowser) return;
    this.bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private unlockPage(): void {
    if (!this.isBrowser) return;
    document.body.style.overflow = this.bodyOverflow;
  }

  private openWidget(next: Widget): void {
    this.widget.set(next);
    afterNextRender(() => this.fitWidget(), { injector: this.injector });
  }

  private partOrigin(card: OverlayCard, part: OverlayPart): { x: number; y: number } {
    if (part === 'icon') return { x: card.x, y: card.y };
    if (part === 'name') return { x: card.nameX, y: card.nameY };
    return { x: card.dyeX, y: card.dyeY };
  }

  private partPatch(part: OverlayPart, x: number, y: number): Partial<OverlayCard> {
    if (part === 'icon') return { x, y };
    if (part === 'name') return { nameX: x, nameY: y };
    return { dyeX: x, dyeY: y };
  }

  private prepareSlotSearch(slot: SlotId): void {
    const def = GLAMOUR_SLOTS.find((item) => item.id === slot);
    if (def) this.insertGroup.set(def.group);
    this.insertSlot.set(slot);
    this.resetInsertSearch();
  }

  private resetInsertSearch(): void {
    this.insertQuery.set('');
    this.insertResults.set([]);
    this.insertError.set(null);
    this.insertSearching.set(false);
    this.dyePicker.set(null);
  }

  private placeWidgetNear(clientX: number, clientY: number): { x: number; y: number } {
    const width = 340;
    const gap = 12;
    let x = clientX + gap;
    if (x + width > window.innerWidth - 8) x = clientX - width - gap;
    return this.clampWidgetBox(x, clientY + gap, width, 360);
  }

  private fitWidget(): void {
    const current = this.widget();
    const el = this.widgetEl()?.nativeElement;
    if (!current || !el) return;
    const next = this.clampWidgetBox(current.x, current.y, el.offsetWidth, el.offsetHeight);
    if (next.x !== current.x || next.y !== current.y) {
      this.widget.update((w) => (w ? { ...w, ...next } : w));
    }
  }

  private clampWidgetBox(x: number, y: number, width: number, height: number): { x: number; y: number } {
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - Math.min(height, window.innerHeight - 16) - 8);
    return { x: clamp(x, 8, maxX), y: clamp(y, 8, maxY) };
  }

  private clampOnCanvas(
    value: number,
    el: HTMLElement | null,
    axis: 'x' | 'y',
    rect: DOMRect,
  ): number {
    const size = el ? (axis === 'x' ? el.offsetWidth : el.offsetHeight) : 0;
    const total = axis === 'x' ? rect.width : rect.height;
    if (total <= 0) return clamp(value, 0, 100);
    const max = Math.max(0, ((total - size) / total) * 100);
    return clamp(value, 0, max);
  }

  private eventPercent(event: MouseEvent): { x: number; y: number } | null {
    const canvas = this.lookCanvas()?.nativeElement;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  private dropAtClick(event: MouseEvent): { x: number; y: number } {
    const canvas = this.lookCanvas()?.nativeElement;
    if (!canvas) return this.dropAtTopCenter();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return this.dropAtTopCenter();
    const half = DEFAULT_OVERLAY_STYLE.iconSize / 2;
    return {
      x: clamp(((event.clientX - rect.left - half) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top - half) / rect.height) * 100, 0, 100),
    };
  }

  private dropAtTopCenter(): { x: number; y: number } {
    const canvas = this.lookCanvas()?.nativeElement;
    const icon = DEFAULT_OVERLAY_STYLE.iconSize;
    if (!canvas) return { x: 50, y: 4 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 50, y: 4 };
    return {
      x: clamp(((rect.width / 2 - icon / 2) / rect.width) * 100, 0, 100),
      y: clamp((8 / rect.height) * 100, 0, 100),
    };
  }

  private upsertOverlay(slot: SlotId, position?: { x: number; y: number }): void {
    const existing = this.overlays().find((card) => card.slot === slot);
    if (existing) {
      if (position) this.patchOverlay(slot, position);
      return;
    }
    this.overlays.update((cards) => [
      ...cards,
      defaultOverlay(slot, cards.length, position),
    ]);
    this.syncUrl();
    afterNextRender(() => this.alignLabels(slot), { injector: this.injector });
  }

  private attachHash(slot: SlotId, hash: string | undefined): boolean {
    const item = this.pins()[slot];
    if (!item) {
      this.snack.open('先加入裝備，再填官方代號', '關閉', { duration: 2800 });
      return false;
    }
    this.pins.update((pins) => ({ ...pins, [slot]: { ...item, lodestoneHash: hash } }));
    this.syncUrl();
    return true;
  }

  private scheduleSearch(run: () => void): void {
    const existing = this.timers.get('insert');
    if (existing) clearTimeout(existing);
    this.timers.set('insert', setTimeout(run, 320));
  }

  private async search(slot: SlotId, raw: string): Promise<void> {
    const q = raw.trim();
    if (q.length < 2) {
      this.insertResults.set([]);
      this.insertSearching.set(false);
      return;
    }
    this.aborts.get('insert')?.abort();
    const abort = new AbortController();
    this.aborts.set('insert', abort);
    this.insertSearching.set(true);
    this.insertError.set(null);
    try {
      const hits = await searchSlotItems(slot, q, abort.signal);
      this.insertResults.set(hits);
      this.insertError.set(hits.length ? null : '沒有符合此欄的裝備');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      this.insertError.set(err instanceof Error ? err.message : '搜尋失敗');
    } finally {
      if (this.aborts.get('insert') === abort) this.insertSearching.set(false);
    }
  }

  private async restoreShare(shared: {
    slots: Partial<Record<SlotId, { id: number; hash?: string; dye1?: number; dye2?: number }>>;
    overlays: OverlayCard[];
  }): Promise<void> {
    const ids = Object.values(shared.slots).map((pin) => pin!.id);
    try {
      const items = await fetchItemsByIds(ids);
      const byId = new Map(items.map((item) => [item.id, item]));
      const nextPins = emptyPins();
      const nextDyes = emptyDyes();
      for (const slot of GLAMOUR_SLOTS) {
        const pin = shared.slots[slot.id];
        if (!pin) continue;
        const item = byId.get(pin.id);
        if (!item) continue;
        nextPins[slot.id] = { ...item, lodestoneHash: pin.hash };
        nextDyes[slot.id] = [pin.dye1 ?? 0, pin.dye2 ?? 0];
      }
      this.pins.set(nextPins);
      this.dyes.set(nextDyes);
      this.overlays.set(
        shared.overlays
          .filter((card) => nextPins[card.slot])
          .map((card, index) => relocateToolbarDrop(card, index)),
      );
      afterNextRender(() => {
        document.querySelector('.ov-icon')?.scrollIntoView({ block: 'center', inline: 'nearest' });
      }, { injector: this.injector });
      if ((this.overlays().length || this.hasPins()) && !this.imageUrl()) this.shareNeedsImage.set(true);
      if (GLAMOUR_SLOTS.some((slot) => nextDyes[slot.id][0] || nextDyes[slot.id][1])) {
        void this.ensureStains();
      }
    } catch {
      this.snack.open('無法從 XIVAPI 還原搭配', '關閉', { duration: 2800 });
    }
  }

  private toShareState() {
    const slots: Partial<Record<SlotId, { id: number; hash?: string; dye1?: number; dye2?: number }>> = {};
    for (const def of GLAMOUR_SLOTS) {
      const item = this.pins()[def.id];
      if (!item) continue;
      const [dye1, dye2] = this.dyes()[def.id];
      slots[def.id] = { id: item.id, hash: item.lodestoneHash, dye1, dye2 };
    }
    return { lang: this.lang(), slots, overlays: this.overlays() };
  }

  private syncUrl(): void {
    if (!this.isBrowser) return;
    if (this.urlTimer) clearTimeout(this.urlTimer);
    this.urlTimer = setTimeout(() => {
      const query = this.hasPins()
        ? Object.fromEntries(new URLSearchParams(buildShareQuery(this.toShareState())))
        : {};
      void this.router.navigate([], { relativeTo: this.route, queryParams: query, replaceUrl: true });
    }, 200);
  }

  private async ensureStains(): Promise<void> {
    if (this.stains().length) return;
    try {
      this.stains.set(await loadStains());
    } catch {
      this.snack.open('染料表載入失敗', '關閉', { duration: 2400 });
    }
  }

  private async hydrateLook(shared: {
    slots: Partial<Record<SlotId, { id: number; hash?: string; dye1?: number; dye2?: number }>>;
    overlays: OverlayCard[];
  } | null): Promise<void> {
    await this.restoreLocalImage();
    if (shared) await this.restoreShare(shared);
  }

  private async restoreLocalImage(): Promise<void> {
    try {
      const blob = await loadLookImage();
      if (!blob) return;
      this.revokeImage();
      this.objectUrl = URL.createObjectURL(blob);
      this.imageUrl.set(this.objectUrl);
      this.shareNeedsImage.set(false);
    } catch { /* ignore */ }
  }

  private setImage(file: File): void {
    this.revokeImage();
    this.objectUrl = URL.createObjectURL(file);
    this.imageUrl.set(this.objectUrl);
    this.shareNeedsImage.set(false);
    void saveLookImage(file).catch(() => undefined);
  }

  private revokeImage(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
