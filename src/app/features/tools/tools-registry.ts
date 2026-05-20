import { ToolEntry } from '../../core/models/tool.model';

export const TOOLS_REGISTRY = [
  {
    id: 'json-formatter',
    name: 'JSON 格式化工具',
    description: '貼入 JSON 以進行格式化、驗證與美化檢視。',
    icon: 'code',
    route: 'json-formatter',
  },
  {
    id: 'uber-eats-settlement',
    name: 'Uber Eats 對帳工具',
    description: '輸入訂單 JSON，自動計算並產生成員應付金額。',
    icon: 'receipt_long',
    route: 'uber-eats-settlement',
  },
  {
    id: 'connection-checker',
    name: 'Connection Checker',
    description: '多端點連線狀態即時監控，可自訂輪詢頻率。',
    icon: 'sensors',
    route: 'connection-checker',
  },
  {
    id: 'number-to-chinese',
    name: '數字轉中文大寫',
    description: '報帳與出差費用的好幫手，阿拉伯數字轉換國字大寫金額。',
    icon: 'payments',
    route: 'number-to-chinese',
  },
  {
    id: 'markdown-editor',
    name: '智慧編輯器',
    description: '支援 Markdown 與 Mermaid 流程圖的開發者筆記本。',
    icon: 'edit_note',
    route: 'markdown-editor',
  },
  {
    id: 'media-declaration-parser',
    name: '媒體申報檔解析工具',
    description: '解析國稅局 TXT 媒體申報檔，自動依法規整期 B2C 逆算稅額，支援特種稅率分群彙總。',
    icon: 'receipt_long',
    route: 'media-declaration-parser',
  },
  {
    id: 'tradevan-parser',
    name: '關貿 CSV 解析工具',
    description: '解析電子發票加值中心下載的 CSV 檔，自動計算 B2C 整期逆算稅額，產出法定申報期總表。',
    icon: 'table_chart',
    route: 'tradevan-parser',
  },
  {
    id: 'barcode-generator',
    name: '條碼與 QR Code 產生器',
    description: '產生高品質 QR Code 與各式條碼（Data Matrix、PDF417、Aztec、Code 128 等），支援漸層色彩、Logo 置入、Wi-Fi 分享與向量 SVG 下載。',
    icon: 'qr_code_2',
    route: 'barcode-generator',
  },
  {
    id: 'barcode-scanner',
    name: '條碼掃描器',
    description: '用手機或電腦鏡頭連續掃描 QR Code、Data Matrix 等二維條碼，支援數量登錄、防誤掃冷卻與 CSV 匯出，可取代 PDA 掃描機。',
    icon: 'document_scanner',
    route: 'barcode-scanner',
  },
] as const satisfies readonly ToolEntry[];


