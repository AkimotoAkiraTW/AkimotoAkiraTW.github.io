export type LodestoneLang = 'ja' | 'en';

export type SlotGroup = 'weapon' | 'armor' | 'accessory' | 'extra';

export type SlotId =
  | 'mainHand'
  | 'offHand'
  | 'head'
  | 'body'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'ears'
  | 'neck'
  | 'wrists'
  | 'ringL'
  | 'ringR'
  | 'outfit';

export interface SlotDef {
  id: SlotId;
  label: string;
  group: SlotGroup;
  queryField?:
    | 'MainHand'
    | 'OffHand'
    | 'Head'
    | 'Body'
    | 'Gloves'
    | 'Legs'
    | 'Feet'
    | 'Ears'
    | 'Neck'
    | 'Wrists'
    | 'FingerL'
    | 'FingerR';
  /** 沒有裝備欄的物品（例如套裝盒）改打 ItemUICategory */
  categoryId?: number;
}

export const SLOT_GROUPS: { id: SlotGroup; label: string }[] = [
  { id: 'weapon', label: '武器' },
  { id: 'armor', label: '防具' },
  { id: 'accessory', label: '飾品' },
  { id: 'extra', label: '套裝' },
];

export const GLAMOUR_SLOTS: readonly SlotDef[] = [
  { id: 'mainHand', label: '主手', group: 'weapon', queryField: 'MainHand' },
  { id: 'offHand', label: '副手', group: 'weapon', queryField: 'OffHand' },
  { id: 'head', label: '頭', group: 'armor', queryField: 'Head' },
  { id: 'body', label: '胴', group: 'armor', queryField: 'Body' },
  { id: 'hands', label: '手', group: 'armor', queryField: 'Gloves' },
  { id: 'legs', label: '腳', group: 'armor', queryField: 'Legs' },
  { id: 'feet', label: '足', group: 'armor', queryField: 'Feet' },
  { id: 'ears', label: '耳飾', group: 'accessory', queryField: 'Ears' },
  { id: 'neck', label: '項鍊', group: 'accessory', queryField: 'Neck' },
  { id: 'wrists', label: '手鐲', group: 'accessory', queryField: 'Wrists' },
  { id: 'ringL', label: '戒指（左）', group: 'accessory', queryField: 'FingerL' },
  { id: 'ringR', label: '戒指（右）', group: 'accessory', queryField: 'FingerR' },
  { id: 'outfit', label: '套裝盒', group: 'extra', categoryId: 112 },
];

export interface GearItem {
  id: number;
  nameJa: string;
  nameEn: string;
  iconPath: string;
  category: string;
  jobs: string;
  levelEquip: number;
  /** 0 不可染、1 單色、2 雙色 */
  dyeCount: number;
  lodestoneHash?: string;
}

export interface Stain {
  id: number;
  nameJa: string;
  nameEn: string;
  hex: string;
}

export interface OverlayCard {
  slot: SlotId;
  x: number;
  y: number;
  nameX: number;
  nameY: number;
  dyeX: number;
  dyeY: number;
  iconSize: number;
  fontSize: number;
  dyeFontSize: number;
  showIcon: boolean;
  showName: boolean;
  showDye: boolean;
  nameShowBg: boolean;
  dyeShowBg: boolean;
  textColor: string;
  dyeColor: string;
  bgColor: string;
  bgAlpha: number;
  borderColor: string;
  borderWidth: number;
  borderAlpha: number;
  linked: boolean;
}

export function displayName(
  item: Pick<GearItem, 'nameJa' | 'nameEn'>,
  lang: LodestoneLang,
): string {
  if (lang === 'ja') return item.nameJa || item.nameEn;
  return item.nameEn || item.nameJa;
}

export function stainName(stain: Stain, lang: LodestoneLang): string {
  return displayName({ nameJa: stain.nameJa, nameEn: stain.nameEn }, lang);
}

export function emptyPins(): Record<SlotId, GearItem | null> {
  return Object.fromEntries(GLAMOUR_SLOTS.map((s) => [s.id, null])) as Record<SlotId, GearItem | null>;
}

export function emptyQueries(): Record<SlotId, string> {
  return Object.fromEntries(GLAMOUR_SLOTS.map((s) => [s.id, ''])) as Record<SlotId, string>;
}

export function emptyDyes(): Record<SlotId, [number, number]> {
  return Object.fromEntries(GLAMOUR_SLOTS.map((s) => [s.id, [0, 0]])) as Record<SlotId, [number, number]>;
}

export const DEFAULT_OVERLAY_STYLE = {
  iconSize: 36,
  fontSize: 13,
  dyeFontSize: 12,
  showIcon: true,
  showName: true,
  showDye: true,
  nameShowBg: true,
  dyeShowBg: true,
  textColor: '#f8fafc',
  dyeColor: '#e2e8f0',
  bgColor: '#0f172a',
  bgAlpha: 0.72,
  borderColor: '#ffffff',
  borderWidth: 0,
  borderAlpha: 0.35,
  linked: true,
} as const;

export function labelsBesideIcon(x: number, y: number): Pick<OverlayCard, 'nameX' | 'nameY' | 'dyeX' | 'dyeY'> {
  return {
    nameX: clampPct(x + 5.2),
    nameY: clampPct(y),
    dyeX: clampPct(x + 5.2),
    dyeY: clampPct(y + 4.4),
  };
}

export function defaultOverlay(slot: SlotId, index: number, at?: { x: number; y: number }): OverlayCard {
  const x = at?.x ?? 6 + (index % 3) * 28;
  const y = at?.y ?? 8 + Math.floor(index / 3) * 16;
  return {
    slot,
    x,
    y,
    ...labelsBesideIcon(x, y),
    ...DEFAULT_OVERLAY_STYLE,
  };
}

export function relocateToolbarDrop(card: OverlayCard, index: number): OverlayCard {
  if (card.y > 0.5 || card.x < 50) return card;
  const x = 8;
  const y = 8 + index * 14;
  return { ...card, x, y, ...labelsBesideIcon(x, y) };
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const n = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw.padStart(6, '0');
  const r = Number.parseInt(n.slice(0, 2), 16) || 0;
  const g = Number.parseInt(n.slice(2, 4), 16) || 0;
  const b = Number.parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
