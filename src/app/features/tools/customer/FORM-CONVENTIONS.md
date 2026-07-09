# CRM 商業夥伴表單慣例

## 標準欄位（`.crm-form-shell` / `.crm-partner-dialog` 內）

```html
<mat-form-field appearance="outline" floatLabel="always">
  <mat-label>欄位名稱（選填）</mat-label>
  <input matInput [formField]="form().path" placeholder="例：…" />
  @if (…) {
    <mat-error>…</mat-error>
  }
</mat-form-field>
```

- **綁定**：Signal Forms 一律 `[formField]`；勿混用 `[(ngModel)]`。
- **placeholder**：僅在 `floatLabel="always"` 時作「格式範例」；必填欄位仍保留簡短範例即可。
- **mat-select 分類**：`#ref` + `(openedChange)` + 區塊 `hidden` 解除後 `updatePosition()`（見 `partner-basic-info`）。
- **區塊**：`surface-card` + `section-title`；切換類用全域 `.segmented-control` + 外部 `.control-label`。
- **日期**：個人生日與其他欄位相同，使用 `mat-form-field` + `matInput type="date"` + `floatLabel="always"`。
- **客戶設定**：嵌在「核心設定」`surface-card` 內（緊接產業欄位），以 `@if (isCustomer())` 展開；schema 使用 `hidden(s.customer, …)` 與 `isCustomer` 同步，**勿**用 `form().customer().hidden()` 控制模板。
- **供應商設定**：獨立 `surface-card` + `@if (isSupplier())`；同樣搭配 `hidden(s.supplier, …)`。
- **陣列字串**：`mainProducts` 用 `[value]`/`(input)` 寫回 `modelSignal`（逗號分隔），詳情以 `、` 顯示。

## 篩選列（列表頁）

`filter-search-panel`：`field-label` + 自訂 search box 或無 `mat-label` 的 `mat-select`；**不**強制 `floatLabel`。

## 唯讀詳情

`partner-detail-panel` 的 `<dt>` 文字應與表單 `<mat-label>` 一致（含「選填」與括號說明）。
