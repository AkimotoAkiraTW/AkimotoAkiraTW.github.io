import {
  DEFAULT_OVERLAY_STYLE,
  GLAMOUR_SLOTS,
  labelsBesideIcon,
  type LodestoneLang,
  type OverlayCard,
  type SlotId,
} from './ff14-glamour.model';

export interface ShareSlot {
  id: number;
  hash?: string;
  dye1?: number;
  dye2?: number;
}

export interface ShareState {
  lang: LodestoneLang;
  slots: Partial<Record<SlotId, ShareSlot>>;
  overlays: OverlayCard[];
}

const SLOT_IDS = new Set<string>(GLAMOUR_SLOTS.map((s) => s.id));

function parseDyeMap(raw: string | null): Partial<Record<SlotId, [number, number]>> {
  const dyes: Partial<Record<SlotId, [number, number]>> = {};
  if (!raw) return dyes;
  for (const part of raw.split(',')) {
    const [slot, values] = part.split(':');
    if (!SLOT_IDS.has(slot) || !values) continue;
    const [a, b] = values.split('.').map((n) => Number(n));
    const dye1 = Number.isInteger(a) && a > 0 ? a : 0;
    const dye2 = Number.isInteger(b) && b > 0 ? b : 0;
    dyes[slot as SlotId] = [dye1, dye2];
  }
  return dyes;
}

function parseHex(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const hex = raw.replace('#', '');
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : fallback;
}

function parseOverlays(raw: string | null): OverlayCard[] {
  if (!raw) return [];
  const cards: OverlayCard[] = [];
  for (const part of raw.split(';')) {
    const [slot, values] = part.split(':');
    if (!SLOT_IDS.has(slot) || !values) continue;
    const bits = values.split(',');
    const x = Number(bits[0]);
    const y = Number(bits[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const flags = Number(bits[4] ?? 7);
    const extra = Number(bits[17] ?? 3);
    const labels = labelsBesideIcon(x, y);
    cards.push({
      slot: slot as SlotId,
      x,
      y,
      iconSize: Number(bits[2]) || DEFAULT_OVERLAY_STYLE.iconSize,
      fontSize: Number(bits[3]) || DEFAULT_OVERLAY_STYLE.fontSize,
      showIcon: (flags & 1) !== 0,
      showName: (flags & 2) !== 0,
      showDye: (flags & 4) !== 0,
      bgAlpha: bits[5] != null ? Number(bits[5]) / 100 : DEFAULT_OVERLAY_STYLE.bgAlpha,
      textColor: parseHex(bits[6], DEFAULT_OVERLAY_STYLE.textColor),
      bgColor: parseHex(bits[7], DEFAULT_OVERLAY_STYLE.bgColor),
      borderWidth: bits[8] != null ? Number(bits[8]) : DEFAULT_OVERLAY_STYLE.borderWidth,
      borderColor: parseHex(bits[9], DEFAULT_OVERLAY_STYLE.borderColor),
      borderAlpha: bits[10] != null ? Number(bits[10]) / 100 : DEFAULT_OVERLAY_STYLE.borderAlpha,
      dyeFontSize: bits[11] != null ? Number(bits[11]) : DEFAULT_OVERLAY_STYLE.dyeFontSize,
      dyeColor: parseHex(bits[12], DEFAULT_OVERLAY_STYLE.dyeColor),
      nameX: bits[13] != null ? Number(bits[13]) : labels.nameX,
      nameY: bits[14] != null ? Number(bits[14]) : labels.nameY,
      dyeX: bits[15] != null ? Number(bits[15]) : labels.dyeX,
      dyeY: bits[16] != null ? Number(bits[16]) : labels.dyeY,
      nameShowBg: (extra & 1) !== 0,
      dyeShowBg: (extra & 2) !== 0,
      linked: (extra & 4) === 0,
    });
  }
  return cards;
}

function overlayFlags(card: OverlayCard): number {
  return (card.showIcon ? 1 : 0) | (card.showName ? 2 : 0) | (card.showDye ? 4 : 0);
}

function extraFlags(card: OverlayCard): number {
  return (card.nameShowBg ? 1 : 0) | (card.dyeShowBg ? 2 : 0) | (card.linked ? 0 : 4);
}

function encodeOverlay(card: OverlayCard): string {
  const labels = labelsBesideIcon(card.x, card.y);
  const base = [
    Math.round(card.x * 10) / 10,
    Math.round(card.y * 10) / 10,
    card.iconSize,
    card.fontSize,
    overlayFlags(card),
  ];
  const styled = [
    Math.round(card.bgAlpha * 100),
    card.textColor.replace('#', ''),
    card.bgColor.replace('#', ''),
    card.borderWidth,
    card.borderColor.replace('#', ''),
    Math.round(card.borderAlpha * 100),
  ];
  const extra = [
    card.dyeFontSize,
    card.dyeColor.replace('#', ''),
    Math.round(card.nameX * 10) / 10,
    Math.round(card.nameY * 10) / 10,
    Math.round(card.dyeX * 10) / 10,
    Math.round(card.dyeY * 10) / 10,
    extraFlags(card),
  ];
  const isDefaultStyle =
    card.bgAlpha === DEFAULT_OVERLAY_STYLE.bgAlpha &&
    card.textColor === DEFAULT_OVERLAY_STYLE.textColor &&
    card.bgColor === DEFAULT_OVERLAY_STYLE.bgColor &&
    card.borderWidth === DEFAULT_OVERLAY_STYLE.borderWidth &&
    card.borderColor === DEFAULT_OVERLAY_STYLE.borderColor &&
    card.borderAlpha === DEFAULT_OVERLAY_STYLE.borderAlpha;
  const isDefaultExtra =
    card.dyeFontSize === DEFAULT_OVERLAY_STYLE.dyeFontSize &&
    card.dyeColor === DEFAULT_OVERLAY_STYLE.dyeColor &&
    card.nameX === labels.nameX &&
    card.nameY === labels.nameY &&
    card.dyeX === labels.dyeX &&
    card.dyeY === labels.dyeY &&
    card.nameShowBg === DEFAULT_OVERLAY_STYLE.nameShowBg &&
    card.dyeShowBg === DEFAULT_OVERLAY_STYLE.dyeShowBg &&
    card.linked === DEFAULT_OVERLAY_STYLE.linked;
  const parts: Array<string | number> = [...base];
  if (!isDefaultStyle || !isDefaultExtra) parts.push(...styled);
  if (!isDefaultExtra) parts.push(...extra);
  return `${card.slot}:${parts.join(',')}`;
}

export function parseShareFromUrl(search: string): ShareState | null {
  const params = new URLSearchParams(search);
  const raw = params.get('slots');
  if (!raw) return null;

  const lang: LodestoneLang = params.get('lang') === 'en' ? 'en' : 'ja';
  const dyes = parseDyeMap(params.get('dye'));
  const slots: ShareState['slots'] = {};

  for (const part of raw.split(',')) {
    const [slot, idText, hash] = part.split(':');
    if (!SLOT_IDS.has(slot)) continue;
    const id = Number(idText);
    if (!Number.isInteger(id) || id <= 0) continue;
    const [dye1, dye2] = dyes[slot as SlotId] ?? [0, 0];
    slots[slot as SlotId] = {
      id,
      hash: hash ? hash.toLowerCase() : undefined,
      dye1,
      dye2,
    };
  }

  return Object.keys(slots).length
    ? { lang, slots, overlays: parseOverlays(params.get('ov')) }
    : null;
}

export function buildShareQuery(state: ShareState): string {
  const slots = GLAMOUR_SLOTS
    .map((def) => {
      const pin = state.slots[def.id];
      if (!pin) return null;
      return pin.hash ? `${def.id}:${pin.id}:${pin.hash}` : `${def.id}:${pin.id}`;
    })
    .filter((part): part is string => part !== null)
    .join(',');

  const dye = GLAMOUR_SLOTS
    .map((def) => {
      const pin = state.slots[def.id];
      if (!pin || (!pin.dye1 && !pin.dye2)) return null;
      return pin.dye2 ? `${def.id}:${pin.dye1 ?? 0}.${pin.dye2}` : `${def.id}:${pin.dye1}`;
    })
    .filter((part): part is string => part !== null)
    .join(',');

  const ov = state.overlays.map(encodeOverlay).join(';');

  const params = new URLSearchParams();
  params.set('v', '1');
  params.set('lang', state.lang);
  if (slots) params.set('slots', slots);
  if (dye) params.set('dye', dye);
  if (ov) params.set('ov', ov);
  return params.toString();
}

export function buildShareUrl(state: ShareState, basePath: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const query = buildShareQuery(state);
  return `${origin}${basePath}?${query}`;
}
