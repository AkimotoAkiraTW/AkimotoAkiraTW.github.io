/**
 * 排列組合計算器 - URL 壓縮分享模組
 *
 * 使用自訂 Bit-Pack + Base64URL 方案（零 npm 依賴）
 *
 * Binary Pack 格式：
 * [0-1]   min     (UInt16, 2 bytes)
 * [2-3]   max     (UInt16, 2 bytes)
 * [4]     N       (UInt8,  1 byte)
 * [5]     K       (UInt8,  1 byte)
 * [6..]   desired bitmask   (ceil(range/8) bytes)
 * [6+m..] excluded bitmask  (ceil(range/8) bytes)
 */

export interface ShareState {
  min: number;
  max: number;
  n: number;
  k: number;
  desired: number[];
  excluded: number[];
}

/** Header 固定長度 */
const HEADER_SIZE = 6;

/**
 * 將號碼陣列壓成 bitmask（相對於 min 的偏移）
 */
function numbersToBitmask(numbers: readonly number[], min: number, byteCount: number): Uint8Array {
  const mask = new Uint8Array(byteCount);
  for (const num of numbers) {
    const offset = num - min;
    if (offset >= 0 && offset < byteCount * 8) {
      mask[Math.floor(offset / 8)] |= 1 << (offset % 8);
    }
  }
  return mask;
}

/**
 * 將 bitmask 還原為號碼陣列
 */
function bitmaskToNumbers(mask: Uint8Array, min: number, max: number): number[] {
  const result: number[] = [];
  const range = max - min + 1;
  for (let i = 0; i < range; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;
    if (byteIndex < mask.length && (mask[byteIndex] & (1 << bitIndex)) !== 0) {
      result.push(min + i);
    }
  }
  return result;
}

/**
 * Uint8Array → Base64URL 字串（瀏覽器原生，同步）
 */
function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL 字串 → Uint8Array
 */
function base64UrlToUint8(str: string): Uint8Array {
  // 還原標準 Base64
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // 補齊 padding
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 將狀態打包為壓縮的 Base64URL 字串
 */
export function packState(state: ShareState): string {
  const range = state.max - state.min + 1;
  const bitmaskByteCount = Math.ceil(range / 8);
  const totalSize = HEADER_SIZE + bitmaskByteCount * 2;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Header
  view.setUint16(0, state.min, true); // little-endian
  view.setUint16(2, state.max, true);
  view.setUint8(4, state.n);
  view.setUint8(5, state.k);

  // Bitmasks
  const bytes = new Uint8Array(buffer);
  const desiredMask = numbersToBitmask(state.desired, state.min, bitmaskByteCount);
  const excludedMask = numbersToBitmask(state.excluded, state.min, bitmaskByteCount);

  bytes.set(desiredMask, HEADER_SIZE);
  bytes.set(excludedMask, HEADER_SIZE + bitmaskByteCount);

  return uint8ToBase64Url(bytes);
}

/**
 * 從 Base64URL 字串還原狀態
 * 格式損壞時回傳 null，不拋出異常
 */
export function unpackState(encoded: string): ShareState | null {
  try {
    const bytes = base64UrlToUint8(encoded);
    if (bytes.length < HEADER_SIZE) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const min = view.getUint16(0, true);
    const max = view.getUint16(2, true);
    const n = view.getUint8(4);
    const k = view.getUint8(5);

    if (min > max || n < 1 || k < 1 || k > n) return null;

    const range = max - min + 1;
    const bitmaskByteCount = Math.ceil(range / 8);
    const expectedSize = HEADER_SIZE + bitmaskByteCount * 2;

    if (bytes.length < expectedSize) return null;

    const desiredMask = bytes.slice(HEADER_SIZE, HEADER_SIZE + bitmaskByteCount);
    const excludedMask = bytes.slice(HEADER_SIZE + bitmaskByteCount, expectedSize);

    const desired = bitmaskToNumbers(desiredMask, min, max);
    const excluded = bitmaskToNumbers(excludedMask, min, max);

    return { min, max, n, k, desired, excluded };
  } catch {
    return null;
  }
}

/**
 * 從當前 URL 的 query string 中解析分享狀態
 */
export function parseShareFromUrl(search: string): ShareState | null {
  const params = new URLSearchParams(search);
  const s = params.get('s');
  if (!s) return null;
  return unpackState(s);
}

/**
 * 產生完整的分享 URL
 */
export function buildShareUrl(state: ShareState, basePath: string): string {
  const packed = packState(state);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${basePath}?s=${packed}`;
}
