import type { LodestoneLang } from './ff14-glamour.model';

const FAN_KIT_SRC = 'https://img.finalfantasyxiv.com/lds/pc/global/js/eorzeadb/loader.js?v2';

/** Lodestone 單筆雜湊，例如 cf6f923c9ee */
const HASH_RE = /[0-9a-f]{10,12}/i;

export function lodestoneHost(lang: LodestoneLang): string {
  return lang === 'ja' ? 'jp.finalfantasyxiv.com' : 'na.finalfantasyxiv.com';
}

export function lodestoneSearchUrl(lang: LodestoneLang, keyword: string): string {
  const q = encodeURIComponent(keyword);
  return `https://${lodestoneHost(lang)}/lodestone/playguide/db/item/?db_search_category=item&q=${q}`;
}

export function lodestoneItemUrl(lang: LodestoneLang, hash: string): string {
  return `https://${lodestoneHost(lang)}/lodestone/playguide/db/item/${hash}/`;
}

/**
 * 從官方代號、單頁網址、Fan Kit HTML、[db:item=…] 或裸雜湊取出 ID。
 */
export function parseLodestoneItemRef(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const fromPath = text.match(/\/lodestone\/playguide\/db\/item\/([0-9a-f]{10,12})\/?/i);
  if (fromPath) return fromPath[1].toLowerCase();

  const fromBb = text.match(/\[db:item=([0-9a-f]{10,12})\]/i);
  if (fromBb) return fromBb[1].toLowerCase();

  if (HASH_RE.test(text) && !/\s/.test(text) && text.length <= 16) {
    const hash = text.match(HASH_RE);
    return hash ? hash[0].toLowerCase() : null;
  }
  return null;
}

export function ensureFanKit(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[src="${FAN_KIT_SRC}"]`)) return;
  const script = document.createElement('script');
  script.src = FAN_KIT_SRC;
  script.async = true;
  document.body.appendChild(script);
}
