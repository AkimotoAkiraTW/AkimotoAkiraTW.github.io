import { GLAMOUR_SLOTS, type GearItem, type SlotId } from './ff14-glamour.model';

const XIVAPI = 'https://v2.xivapi.com/api';
const ITEM_FIELDS = [
  'Name',
  'Name@lang(en)',
  'Icon',
  'ItemUICategory.Name',
  'ClassJobCategory.Name',
  'LevelEquip',
  'DyeCount',
].join(',');

interface XivIcon {
  path?: string;
  path_hr1?: string;
}

interface XivNamed {
  fields?: { Name?: string };
}

interface XivItemFields {
  Name?: string;
  'Name@lang(en)'?: string;
  Icon?: XivIcon;
  ItemUICategory?: XivNamed;
  ClassJobCategory?: XivNamed;
  LevelEquip?: number;
  DyeCount?: number;
}

interface XivRow {
  row_id: number;
  fields?: XivItemFields;
}

export function xivIconUrl(path: string): string {
  return `${XIVAPI}/asset?path=${encodeURIComponent(path)}&format=png`;
}

export function sanitizeQuery(raw: string): string {
  return raw.replace(/["\\]/g, '').trim();
}

function mapRow(row: XivRow): GearItem | null {
  const fields = row.fields;
  if (!fields?.Name && !fields?.['Name@lang(en)']) return null;
  const dyeCount = Number(fields.DyeCount ?? 0);
  return {
    id: row.row_id,
    nameJa: fields.Name ?? '',
    nameEn: fields['Name@lang(en)'] ?? '',
    iconPath: fields.Icon?.path_hr1 || fields.Icon?.path || '',
    category: fields.ItemUICategory?.fields?.Name ?? '',
    jobs: fields.ClassJobCategory?.fields?.Name ?? '',
    levelEquip: fields.LevelEquip ?? 0,
    dyeCount: dyeCount === 1 || dyeCount === 2 ? dyeCount : 0,
  };
}

function slotClause(slot: SlotId, q: string): string {
  const def = GLAMOUR_SLOTS.find((s) => s.id === slot);
  const name = `+(Name@ja~"${q}" Name@en~"${q}")`;
  if (def?.categoryId != null) {
    return `+ItemUICategory=${def.categoryId} ${name}`;
  }
  return `+EquipSlotCategory.${def?.queryField ?? 'Head'}=1 ${name}`;
}

export async function searchSlotItems(
  slot: SlotId,
  rawQuery: string,
  signal?: AbortSignal,
): Promise<GearItem[]> {
  const q = sanitizeQuery(rawQuery);
  if (q.length < 2) return [];

  const url = new URL(`${XIVAPI}/search`);
  url.searchParams.set('sheets', 'Item');
  url.searchParams.set('language', 'ja');
  url.searchParams.set('fields', ITEM_FIELDS);
  url.searchParams.set('query', slotClause(slot, q));
  url.searchParams.set('limit', '8');

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`XIVAPI 搜尋失敗（${res.status}）`);
  }
  const body = (await res.json()) as { results?: XivRow[] };
  return (body.results ?? []).map(mapRow).filter((item): item is GearItem => item !== null);
}

export async function fetchItemsByIds(
  ids: number[],
  signal?: AbortSignal,
): Promise<GearItem[]> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (unique.length === 0) return [];

  const url = new URL(`${XIVAPI}/sheet/Item`);
  url.searchParams.set('language', 'ja');
  url.searchParams.set('fields', ITEM_FIELDS);
  url.searchParams.set('rows', unique.join(','));

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`XIVAPI 讀取裝備失敗（${res.status}）`);
  }
  const body = (await res.json()) as { rows?: XivRow[] };
  return (body.rows ?? []).map(mapRow).filter((item): item is GearItem => item !== null);
}
