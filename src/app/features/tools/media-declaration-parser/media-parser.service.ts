import { Injectable } from '@angular/core';

// ─── 資料模型 ─────────────────────────────────────────────────────────────────

export interface MediaRecord {
  filename: string;
  period: string;
  buyerId: string;
  sellerId: string;
  track: string;
  invNo: string;
  amount: number;
  origTax: number;
  salesAmt: number;
  taxAmt: number;
  taxType: string;       // 第 61 碼：課稅別 (1=應稅, 2=零稅率, 3=免稅, F=作廢, D=空白)
  specialTaxCode: string; // 第 79 碼：特種稅額稅率代號 (1,2,3...=特種稅率, ' '=一般)
  isB2C: boolean;
  isVoid: boolean;
  isExempt: boolean;
}

export interface MediaStats {
  // 發票張數
  invTotal: number;
  invValid: number;
  invVoid: number;
  invB2C: number;
  invB2B: number;
  totalRows: number;
  // 一般應稅 (taxType='1', specialTaxCode=' ')
  b2cGross: number;
  b2cSalesAgg: number;
  b2cTaxAgg: number;
  b2bSales: number;
  b2bTax: number;
  taxSales: number;
  taxAmount: number;
  taxGross: number;
  // 特種稅額 (specialTaxCode has value)
  specialB2cGross: number;
  specialB2cSalesAgg: number;
  specialB2cTaxAgg: number;
  specialB2bSales: number;
  specialB2bTax: number;
  specialTaxSales: number;
  specialTaxAmount: number;
  // 零稅率 (taxType='0' or '2')
  zeroCount: number;
  zeroSales: number;
  // 免稅 (taxType='F' or '3')
  exCount: number;
  exSales: number;
  // 總計
  totalSales: number;
  totalTax: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MediaParserService {

  /**
   * 解析媒體申報 TXT 檔案內容（固定寬度格式，81 Bytes/行）
   * 依財政部《營業稅電子資料申報繳稅作業要點》附件格式
   */
  parseFile(text: string, filename: string): MediaRecord[] {
    const lines = text.split(/\r?\n/);
    const records: MediaRecord[] = [];

    for (const raw of lines) {
      if (raw.length < 72) continue;

      // ── 欄位截取（0-indexed）────────────────────────────────────────────────
      // 0-22  (23): 申報資訊
      // 23-30 (8):  買受人統編（空白=自然人 B2C）
      // 31-38 (8):  開立人統編
      // 39-40 (2):  字軌
      // 41-48 (8):  發票號碼
      // 49-60 (12): 銷售金額（B2C=含稅定價; B2B=未稅）
      // 61    (1):  課稅別 (1=應稅, 2=零稅率, 3=免稅, F=作廢, D=未使用)
      // 62-71 (10): 稅額欄（B2B 原始稅額）
      // 72    (1):  扣抵代號（銷項通常空白）
      // 73-77 (5):  官方保留空白
      // 78    (1):  特種稅額稅率代號（空白=一般應稅, 1=酒家25%, 2=夜總會15%...）
      // 79    (1):  彙加/分攤註記
      // 80    (1):  通關方式
      const period        = raw.substring(18, 23).trim();
      const buyerId       = raw.substring(23, 31).trim();
      const sellerId      = raw.substring(31, 39).trim();
      const track         = raw.substring(39, 41).trim();
      const invNo         = raw.substring(41, 49).trim();
      const amtStr        = raw.substring(49, 61).trim();
      const taxType       = raw.substring(61, 62).trim();
      const taxStr        = raw.substring(62, 72).trim();
      const specialTaxCode = raw.length > 78 ? raw.substring(78, 79).trim() : '';

      const amount  = parseInt(amtStr, 10) || 0;
      const origTax = parseInt(taxStr, 10) || 0;
      const isB2C   = buyerId === '';
      const isVoid  = taxType === 'F' || taxType === 'D';
      const isExempt = taxType === 'F' || taxType === '3' || taxType === '0' || taxType === '2' || taxType === 'D';

      let salesAmt: number;
      let taxAmt: number;

      if (isExempt) {
        // 作廢、免稅、零稅率：不計算稅額
        salesAmt = amount;
        taxAmt   = 0;
      } else if (isB2C) {
        // B2C 應稅（含一般應稅 & 特種稅額）：依第 32 條，定價即含稅
        // 不逐筆拆分，整期彙總後再逆算（在統計函式中處理）
        salesAmt = amount;
        taxAmt   = 0; // 標示為 0，在彙總函式中用逆算正確回推
      } else {
        // B2B：直接讀取原始未稅額與稅額
        salesAmt = amount;
        taxAmt   = origTax;
      }

      records.push({
        filename, period, buyerId, sellerId,
        track, invNo, amount, origTax,
        salesAmt, taxAmt,
        taxType, specialTaxCode,
        isB2C, isVoid, isExempt,
      });
    }

    return records;
  }

  /**
   * 計算統計資料
   * @param rows 要計算的資料列（可為過濾後的子集）
   * @param generalRate 一般應稅稅率（小數，e.g. 0.05）
   * @param specialRate 特種稅額稅率（小數，e.g. 0.25）
   */
  calcStats(rows: MediaRecord[], generalRate: number, specialRate: number): MediaStats {
    // ── 發票張數（依字軌+號碼去重）──────────────────────────────────────────
    const invMap = new Map<string, { maxAmt: number; isB2C: boolean; isVoid: boolean }>();
    for (const r of rows) {
      const key = r.track + r.invNo;
      if (!invMap.has(key)) {
        invMap.set(key, { maxAmt: r.amount, isB2C: r.isB2C, isVoid: r.isVoid });
      } else {
        const cur = invMap.get(key)!;
        if (r.amount > cur.maxAmt) cur.maxAmt = r.amount;
      }
    }
    const invEntries = [...invMap.values()];
    const invTotal  = invEntries.length;
    const invValid  = invEntries.filter(v => v.maxAmt > 0 && !v.isVoid).length;
    const invVoid   = invEntries.filter(v => v.isVoid).length;
    const invB2C    = invEntries.filter(v => v.isB2C && !v.isVoid).length;
    const invB2B    = invEntries.filter(v => !v.isB2C && !v.isVoid).length;

    // ── 一般應稅 (taxType='1', specialTaxCode='') ────────────────────────────
    const generalTaxRows = rows.filter(r => r.taxType === '1' && r.specialTaxCode === '');
    const generalB2cRows = generalTaxRows.filter(r => r.isB2C);
    const generalB2bRows = generalTaxRows.filter(r => !r.isB2C);

    const b2cGross    = generalB2cRows.reduce((s, r) => s + r.amount, 0);
    const b2cSalesAgg = Math.round(b2cGross / (1 + generalRate));
    const b2cTaxAgg   = b2cGross - b2cSalesAgg;
    const b2bSales    = generalB2bRows.reduce((s, r) => s + r.amount, 0);
    const b2bTax      = generalB2bRows.reduce((s, r) => s + r.origTax, 0);
    const taxSales    = b2cSalesAgg + b2bSales;
    const taxAmount   = b2cTaxAgg + b2bTax;
    const taxGross    = taxSales + taxAmount;

    // ── 特種稅額 (specialTaxCode has value) ─────────────────────────────────
    const specialRows    = rows.filter(r => r.specialTaxCode !== '' && !r.isVoid);
    const specialB2cRows = specialRows.filter(r => r.isB2C);
    const specialB2bRows = specialRows.filter(r => !r.isB2C);

    const specialB2cGross    = specialB2cRows.reduce((s, r) => s + r.amount, 0);
    const specialB2cSalesAgg = specialRate > 0 ? Math.round(specialB2cGross / (1 + specialRate)) : 0;
    const specialB2cTaxAgg   = specialB2cGross - specialB2cSalesAgg;
    const specialB2bSales    = specialB2bRows.reduce((s, r) => s + r.amount, 0);
    const specialB2bTax      = specialB2bRows.reduce((s, r) => s + r.origTax, 0);
    const specialTaxSales    = specialB2cSalesAgg + specialB2bSales;
    const specialTaxAmount   = specialB2cTaxAgg + specialB2bTax;

    // ── 零稅率 ───────────────────────────────────────────────────────────────
    const zeroRows  = rows.filter(r => r.taxType === '0' || r.taxType === '2');
    const zeroSales = zeroRows.reduce((s, r) => s + r.amount, 0);

    // ── 免稅 ─────────────────────────────────────────────────────────────────
    const exRows  = rows.filter(r => r.taxType === 'F' || r.taxType === '3');
    const exSales = exRows.reduce((s, r) => s + r.amount, 0);

    // ── 總計 ─────────────────────────────────────────────────────────────────
    const totalSales = taxSales + specialTaxSales + zeroSales + exSales;
    const totalTax   = taxAmount + specialTaxAmount;

    return {
      invTotal, invValid, invVoid, invB2C, invB2B, totalRows: rows.length,
      b2cGross, b2cSalesAgg, b2cTaxAgg, b2bSales, b2bTax,
      taxSales, taxAmount, taxGross,
      specialB2cGross, specialB2cSalesAgg, specialB2cTaxAgg,
      specialB2bSales, specialB2bTax,
      specialTaxSales, specialTaxAmount,
      zeroCount: zeroRows.length, zeroSales,
      exCount: exRows.length, exSales,
      totalSales, totalTax,
    };
  }

  /**
   * 匯出 CSV（包含法定申報期總表彙總列）
   */
  exportCsv(rows: MediaRecord[], generalRate: number, specialRate: number): void {
    const header = [
      '序號','期別','字軌號碼','買受人統編','課稅別','特種代號','類型',
      '帳載金額','銷售額(B2B未稅/B2C含稅)','明細稅額','原始稅額欄'
    ];

    const dataRows = rows.map((r, i) => [
      i + 1,
      r.period,
      r.track + r.invNo,
      r.buyerId || '（自然人）',
      r.taxType,
      r.specialTaxCode || '',
      r.isB2C ? '自然人' : '法人',
      r.amount,
      r.salesAmt,
      (r.isB2C && r.taxType === '1') ? '0(內含)' : r.taxAmt,
      r.origTax,
    ]);

    // 法定申報期總表（分群彙總）
    const s = this.calcStats(rows, generalRate, specialRate);
    const totalRow = [
      '', '', '', '', '', '', '【法定申報期總表】',
      s.b2cGross + s.b2bSales + s.b2bTax + s.specialB2cGross + s.specialB2bSales + s.specialB2bTax,
      s.taxSales + s.specialTaxSales,
      s.taxAmount + s.specialTaxAmount,
      '',
    ];

    const csv = [header, ...dataRows, [], totalRow].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `媒體申報解析_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }
}
