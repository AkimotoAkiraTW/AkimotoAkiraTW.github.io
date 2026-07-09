# KC Toolkit & Portfolio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Angular](https://img.shields.io/badge/Angular-21.1-dd0031.svg)](https://angular.io/)

這是 KC 的個人工具箱與作品集網站，託管於 GitHub Pages。本專案旨在提供一系列開發者實用工具，並整合現代網頁技術與自動化對帳邏輯。

## 🛠️ 目前已集成的工具

1. **JSON 結構化工具**：貼入 JSON 以進行格式化、驗證與美化檢視。
2. **Uber Eats 對帳工具**：輸入訂單 JSON，自動計算並產生成員應付金額。
3. **Connection Checker**：多端點連線狀態即時監控，可自訂輪詢頻率。
4. **數字轉中文大寫**：報帳與出差費用的好幫手，阿拉伯數字轉換國字大寫金額。
5. **智慧編輯器**：支援 Markdown 與 Mermaid 流程圖的開發者筆記本。
6. **媒體申報檔解析工具**：解析國稅局 TXT 媒體申報檔，自動依法規整期 B2C 逆算稅額，支援特種稅率分群彙總。
7. **關貿 CSV 解析工具**：解析電子發票加值中心下載的 CSV 檔，自動計算 B2C 整期逆算稅額，產出法定申報期總表。
8. **條碼與 QR Code 產生器**：產生高品質 QR Code 與各式條碼（Data Matrix、PDF417、Aztec、Code 128 等），支援漸層色彩、Logo 置入、Wi-Fi 分享與向量 SVG 下載。
9. **條碼掃描器**：用手機或電腦鏡頭連續掃描 QR Code、Data Matrix 等二維條碼，支援數量登錄、防誤掃冷卻與 CSV 匯出，可取代 PDA 掃描機。
10. **離線 CRM 客戶管理**：具備原生校驗與 Fluent IndexedDB 查詢引擎的離線首選 CRM 快取資料庫，支援欄位過濾與軟刪除機制。
11. **排列組合計算器**：設定號碼區間與 N 取 K 參數，以 DFS 回溯演算法生成所有組合，內建 OOM 防護與 URL 壓縮分享機制。

## 📦 內容與維護

| 類型 | 請手動編輯（單一來源） | `npm run content` 會更新 |
|------|------------------------|---------------------------|
| 工具箱 | `src/assets/data/tools.json` + `app.routes.ts` + 元件目錄 | `blog/index.json`、README 工具列表 |
| 部落格 | `src/assets/blog/<slug>.md` | `blog/index.json` |
| 全站設定 | `src/assets/data/site.json`（名稱、導覽文字） | — |
| 履歷／作品集 | `resume.json`、`portfolio.json` | — |

```bash
npm run content              # 同步衍生檔 + 驗證（改 tools / blog 後、commit 前）
npm run tool:create -- <id>    # 新工具 scaffold
npm run build                  # 內含 content，再 Angular 建置
```

- 需要 **Node.js**（執行腳本），與 Git 無關；不必為了 content 而完整 `ng build`。
- CI：`content-check` 驗證 PR；`deploy` 在 `build` 時會再跑一輪 `content`。
- 請勿手改 README 的工具列表區塊；`site.json` 不再存放工具清單。

## 🚀 技術棧

-   **Core**: Angular 21 (Signals, Standalone Components)
-   **UI**: Angular Material & CDK
-   **Parsing**: Marked.js, Mermaid.js
-   **Barcode**: qrcode (QR Code 產生), bwip-js (2D/1D 條碼渲染)
-   **Deployment**: Automated GitHub Actions to GitHub Pages

## 📄 授權聲明

本專案採用 [MIT License](LICENSE) 授權，歡迎學習參考。

---
© 2026 KC. Built with ☕ and Code.
