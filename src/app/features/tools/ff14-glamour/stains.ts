import type { Stain } from './ff14-glamour.model';

const XIVAPI = 'https://v2.xivapi.com/api';

interface StainRow {
  row_id: number;
  fields?: {
    Name?: string;
    'Name@lang(en)'?: string;
    Color?: number;
  };
}

let cached: Stain[] | null = null;
let inflight: Promise<Stain[]> | null = null;

function toHex(color: number): string {
  return `#${Math.max(0, color).toString(16).padStart(6, '0')}`;
}

function mapRow(row: StainRow): Stain | null {
  const nameJa = row.fields?.Name?.trim() ?? '';
  const nameEn = row.fields?.['Name@lang(en)']?.trim() ?? '';
  if (row.row_id === 0) {
    return { id: 0, nameJa: nameJa || '染色無し', nameEn: nameEn || 'No Color', hex: '#d4d4d8' };
  }
  if (!nameJa && !nameEn) return null;
  return {
    id: row.row_id,
    nameJa,
    nameEn,
    hex: toHex(row.fields?.Color ?? 0),
  };
}

export async function loadStains(signal?: AbortSignal): Promise<Stain[]> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const url = new URL(`${XIVAPI}/sheet/Stain`);
    url.searchParams.set('language', 'ja');
    url.searchParams.set('fields', 'Name,Name@lang(en),Color');
    url.searchParams.set('limit', '200');
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`XIVAPI 染料表失敗（${res.status}）`);
    const body = (await res.json()) as { rows?: StainRow[] };
    const stains = (body.rows ?? []).map(mapRow).filter((row): row is Stain => row !== null);
    cached = stains;
    return stains;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function filterStains(stains: Stain[], raw: string): Stain[] {
  const q = raw.trim().toLowerCase();
  if (!q) return stains;
  return stains.filter(
    (stain) =>
      stain.nameJa.toLowerCase().includes(q) ||
      stain.nameEn.toLowerCase().includes(q),
  );
}
