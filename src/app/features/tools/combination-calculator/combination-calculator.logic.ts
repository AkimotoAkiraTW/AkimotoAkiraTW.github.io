/**
 * 排列組合計算器 - 核心演算法模組
 *
 * 包含：
 * - getCombinationCount(): C(n,k) 數值預算
 * - fisherYatesShuffle(): Fisher-Yates 洗牌
 * - generateCombinations(): DFS 回溯生成所有 k-組合
 * - validateParams(): 防禦性參數邊界驗證
 */

// ── 開發者可調控之系統極限參數 ──
export const SYSTEM_LIMITS = {
  /** 記憶體中最多允許生成的組合數 */
  MAX_COMBINATIONS_MEMORY: 200_000,
  /** 畫面上最多渲染的 DOM 節點數 */
  MAX_COMBINATIONS_RENDER: 3_000,
};

/**
 * 計算數學組合數 C(n, k)
 * 使用迭代乘除法避免大數階乘溢出
 */
export function getCombinationCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  // 取較小的 k 以減少迭代次數
  if (k > n - k) k = n - k;
  let count = 1;
  for (let i = 1; i <= k; i++) {
    count = Math.round((count * (n - i + 1)) / i);
  }
  return count;
}

/**
 * Fisher-Yates 洗牌演算法（不影響原陣列）
 */
export function fisherYatesShuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * DFS 回溯演算法生成所有 k-組合
 * @param arr - 已排序的數字陣列（母體）
 * @param k   - 每組組合的長度
 * @returns 所有 C(arr.length, k) 組合的二維陣列
 */
export function generateCombinations(arr: readonly number[], k: number): number[][] {
  const result: number[][] = [];

  function backtrack(start: number, path: number[]): void {
    if (path.length === k) {
      result.push([...path]);
      return;
    }
    // 剪枝：剩餘候選數量不足以填滿 k
    for (let i = start; i <= arr.length - (k - path.length); i++) {
      path.push(arr[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  }

  backtrack(0, []);
  return result;
}

/** 驗證結果型別 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 防禦性邊界驗證
 */
export function validateParams(
  min: number,
  max: number,
  n: number,
  k: number,
  desired: readonly number[],
  excluded: readonly number[],
): ValidationResult {
  if (isNaN(n) || isNaN(k) || n < 1 || k < 1) {
    return { valid: false, error: '抽取數 N 與組合長度 K 必須大於 0。' };
  }
  if (isNaN(min) || isNaN(max) || min > max) {
    return { valid: false, error: '母體區間無效，最小值不可大於最大值。' };
  }
  if (k > n) {
    return {
      valid: false,
      error: `邏輯錯誤：組合長度 K (${k}) 不能大於抽取總碼數 N (${n})。`,
    };
  }
  if (desired.length > n) {
    return {
      valid: false,
      error: `必含數字數量 (${desired.length}) 不可超過抽取總數 N (${n})。`,
    };
  }

  const availablePoolSize = max - min + 1 - excluded.length - desired.length;
  const neededCount = n - desired.length;
  if (neededCount > 0 && availablePoolSize < neededCount) {
    return {
      valid: false,
      error: `母體空間不足：需再隨機補足 ${neededCount} 碼，但過濾後的號碼池僅剩 ${availablePoolSize} 碼。`,
    };
  }

  const theoreticalCount = getCombinationCount(n, k);
  if (theoreticalCount > SYSTEM_LIMITS.MAX_COMBINATIONS_MEMORY) {
    return {
      valid: false,
      error: `運算極限保護：C(${n},${k}) = ${theoreticalCount.toLocaleString()} 種組合，已超過安全上限 (${SYSTEM_LIMITS.MAX_COMBINATIONS_MEMORY.toLocaleString()})。`,
    };
  }

  return { valid: true };
}

/**
 * 從母體中依約束條件抽取 N 個數字
 */
export function generateSelections(
  min: number,
  max: number,
  n: number,
  desired: readonly number[],
  excluded: readonly number[],
): number[] {
  const excludedSet = new Set(excluded);
  const desiredSet = new Set(desired);

  // 建立有效母體池（排除 desired 與 excluded）
  const pool: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!excludedSet.has(i) && !desiredSet.has(i)) {
      pool.push(i);
    }
  }

  const needed = n - desired.length;
  const shuffled = fisherYatesShuffle(pool);
  const picked = shuffled.slice(0, needed);

  return [...desired, ...picked].sort((a, b) => a - b);
}
