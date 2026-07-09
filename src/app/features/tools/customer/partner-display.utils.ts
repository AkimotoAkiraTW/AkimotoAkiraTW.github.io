import { Partner } from './partner.model';

export function resolveCategoryName(
  categoryId: string | undefined,
  categories: Array<{ id?: string; name: string }>
): string {
  if (!categoryId) return '未分類';
  return categories.find((c) => c.id === categoryId)?.name ?? '未分類';
}

export function formatPartnerRoles(partner: Partner): string {
  const roles: string[] = [];
  if (partner.isCustomer) roles.push('客戶');
  if (partner.isSupplier) roles.push('供應商');
  return roles.length ? roles.join('、') : '未設定角色';
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAddressLine(addr: {
  city: string;
  district?: string;
  address: string;
  postalCode?: string;
}): string {
  const parts = [addr.postalCode, addr.city, addr.district, addr.address].filter(Boolean);
  return parts.join(' ') || '—';
}

export function partnerStatistics(partners: Partner[]) {
  return {
    total: partners.length,
    active: partners.filter((p) => p.isActive).length,
    customers: partners.filter((p) => p.isCustomer).length,
    suppliers: partners.filter((p) => p.isSupplier).length,
    both: partners.filter((p) => p.isCustomer && p.isSupplier).length,
  };
}

export type PartnerStats = ReturnType<typeof partnerStatistics>;
