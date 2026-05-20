import { Injectable } from '@angular/core';

// ─── 資料模型 ─────────────────────────────────────────────────────────────────

export interface TradevanRecord {
  invNo: string;
  isVoid: boolean;
  date: string;
  unit: string;
  buyerId: string;
  buyerName: string;
  taxableAmt: number;   // 應稅金額（B2C=含稅定價, B2B=未稅）
  zeroTaxAmt: number;   // 零稅率銷售金額
  exemptAmt: number;    // 免稅銷售金額
  taxAmt: number;       // 明細稅額（B2C 依法為 0，整期回推）
  totalAmt: number;     // 合計（參考用）
  isB2C: boolean;
  origTaxableAmt: number; // 原始含稅應稅金額（B2C 整期回推用）
}

export interface TradevanStats {
  invTotal: number;
  invValid: number;
  invVoid: number;
  invB2C: number;
  invB2B: number;
  // 一般應稅
  b2cGross: number;
  b2cSalesAgg: number;
  b2cTaxAgg: number;
  b2bSales: number;
  b2bTax: number;
  taxSalesTotal: number;
  taxAmountTotal: number;
  taxGrossTotal: number;
  // 零稅率/免稅
  zeroSales: number;
  exSales: number;
  // 總計
  totalSales: number;
  totalTax: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TradevanParserService {

  /**
   * 解析關貿 CSV 格式
   * 欄位: 發票號碼, 發票日期, 單位代碼, 買受人統編, 買受人名稱,
   *       應稅金額, 零稅金額, 免稅金額, 稅額, 合計
   */
  parseCSV(text: string): TradevanRecord[] {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const records: TradevanRecord[] = [];

    for (const line of lines) {
      const cols = line.split(',');
      if (cols.length < 10) continue;

      let invNo = cols[0].trim();
      // 僅接受發票號碼格式（允許 * 開頭代表作廢）
      if (!/^\*?[A-Z0-9]{10}$/i.test(invNo)) continue;

      const isVoid = invNo.startsWith('*');
      if (isVoid) invNo = invNo.substring(1);

      const date      = cols[1].trim();
      const unit      = cols[2].trim();
      const buyerId   = cols[3].trim();
      const buyerName = cols[4].trim();

      const taxableAmt = parseInt(cols[5]) || 0;
      const zeroTaxAmt = parseInt(cols[6]) || 0;
      const exemptAmt  = parseInt(cols[7]) || 0;
      let   taxAmt     = parseInt(cols[8]) || 0;
      const totalAmt   = parseInt(cols[9]) || 0;

      // 自然人：統編 0000000000 或空白
      const isB2C = (buyerId === '0000000000' || buyerId === '');

      // B2C 應稅：依第 32 條，定價即含稅，不逐筆拆稅額
      const origTaxableAmt = taxableAmt;
      if (!isVoid && isB2C && taxableAmt > 0) {
        taxAmt = 0; // 整期彙總後逆算，不逐筆拆分
      }

      records.push({
        invNo, isVoid, date, unit, buyerId, buyerName,
        taxableAmt, zeroTaxAmt, exemptAmt, taxAmt, totalAmt,
        isB2C, origTaxableAmt,
      });
    }

    return records;
  }

  /**
   * 計算統計（依施行細則 32-1 條整期逆算 B2C 稅額）
   * @param rows 全部資料（統計永遠基於全部有效發票）
   * @param generalRate 一般稅率（小數）
   */
  calcStats(rows: TradevanRecord[], generalRate: number): TradevanStats {
    const invValid = rows.filter(r => !r.isVoid);
    const invVoid  = rows.filter(r => r.isVoid);
    const invB2C   = invValid.filter(r => r.isB2C);
    const invB2B   = invValid.filter(r => !r.isB2C);

    // B2C 整期一次逆算（法定標準）
    const b2cGross    = invB2C.reduce((s, r) => s + r.origTaxableAmt, 0);
    const b2cSalesAgg = Math.round(b2cGross / (1 + generalRate));
    const b2cTaxAgg   = b2cGross - b2cSalesAgg;

    // B2B 直接加總
    const b2bSales = invB2B.reduce((s, r) => s + r.taxableAmt, 0);
    const b2bTax   = invB2B.reduce((s, r) => s + r.taxAmt, 0);

    const taxSalesTotal  = b2cSalesAgg + b2bSales;
    const taxAmountTotal = b2cTaxAgg + b2bTax;
    const taxGrossTotal  = taxSalesTotal + taxAmountTotal;

    const zeroSales = invValid.reduce((s, r) => s + r.zeroTaxAmt, 0);
    const exSales   = invValid.reduce((s, r) => s + r.exemptAmt, 0);
    const totalSales = taxSalesTotal + zeroSales + exSales;

    return {
      invTotal: rows.length, invValid: invValid.length,
      invVoid: invVoid.length, invB2C: invB2C.length, invB2B: invB2B.length,
      b2cGross, b2cSalesAgg, b2cTaxAgg, b2bSales, b2bTax,
      taxSalesTotal, taxAmountTotal, taxGrossTotal,
      zeroSales, exSales, totalSales, totalTax: taxAmountTotal,
    };
  }

  /**
   * 匯出 CSV（含法定申報期總表彙總列）
   */
  exportCsv(rows: TradevanRecord[], generalRate: number): void {
    const header = [
      '狀態','發票號碼','發票日期','單位代碼','買受人統編','買受人名稱',
      '銷售額(B2B未稅/B2C含稅)','零稅銷售金額','免稅銷售金額','明細稅額','合計(參考)'
    ];
    const dataRows = rows.map(r => [
      r.isVoid ? '作廢' : '正常',
      r.invNo, r.date, r.unit, r.buyerId, r.buyerName,
      r.taxableAmt, r.zeroTaxAmt, r.exemptAmt,
      (r.isB2C && r.taxableAmt > 0) ? '0(內含)' : r.taxAmt,
      r.totalAmt,
    ]);

    const validRows = rows.filter(r => !r.isVoid);
    const b2cRows   = validRows.filter(r => r.isB2C);
    const b2bRows   = validRows.filter(r => !r.isB2C);
    const b2cGross    = b2cRows.reduce((s, r) => s + r.origTaxableAmt, 0);
    const b2cSalesAgg = Math.round(b2cGross / (1 + generalRate));
    const b2cTaxAgg   = b2cGross - b2cSalesAgg;
    const b2bSales    = b2bRows.reduce((s, r) => s + r.taxableAmt, 0);
    const b2bTax      = b2bRows.reduce((s, r) => s + r.taxAmt, 0);
    const zeroTaxAmt  = validRows.reduce((s, r) => s + r.zeroTaxAmt, 0);
    const exemptAmt   = validRows.reduce((s, r) => s + r.exemptAmt, 0);

    const totalRow = [
      '','','','','','【法定申報期總表】',
      b2cSalesAgg + b2bSales, zeroTaxAmt, exemptAmt,
      b2cTaxAgg + b2bTax,
      b2cGross + b2bSales + b2bTax + zeroTaxAmt + exemptAmt,
    ];

    const csv = [header, ...dataRows, [], totalRow].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `關貿發票解析_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }
}
