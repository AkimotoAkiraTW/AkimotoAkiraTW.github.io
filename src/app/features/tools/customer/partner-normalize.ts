import {
  AdditionalContact,
  EnterpriseProfile,
  IndividualProfile,
  Partner,
  PartnerAddress,
  PartnerFormValue,
  PartnerType,
  CustomerProfile,
  SupplierProfile,
} from './partner.model';

export function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;
  const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

export function emptyIndividual(): IndividualProfile {
  return {
    lastName: '',
    firstName: '',
    phone: '',
    email: '',
    identificationNumber: '',
    birthDate: '',
  };
}

export function emptyEnterprise(): EnterpriseProfile {
  return {
    companyName: '',
    businessID: '',
    taxID: '',
    responsiblePerson: '',
    phone: '',
    email: '',
  };
}

export function emptyCustomerProfile(): CustomerProfile {
  return {
    customerCode: '',
    categoryId: '',
    settlementDay: null,
    paymentTerms: '',
  };
}

export function emptySupplierProfile(): SupplierProfile {
  return {
    supplierCode: '',
    categoryId: '',
    mainProducts: [],
    sourceLocation: '',
    leadTimeNotes: '',
    deliveryTerms: '',
    paymentTerms: '',
  };
}

/** 新增表單用的完整草稿（含 hidden 區塊所需空物件）。 */
export function createEmptyPartner(): PartnerFormValue {
  return {
    partnerType: 'individual',
    isActive: true,
    isCustomer: false,
    isSupplier: false,
    individual: emptyIndividual(),
    enterprise: emptyEnterprise(),
    customer: emptyCustomerProfile(),
    supplier: emptySupplierProfile(),
    addresses: [],
    additionalContacts: [],
    industry: '',
    notes: '',
    tags: [],
    displayName: '',
    primaryPhone: '',
    primaryEmail: '',
    primaryCity: '',
  };
}

/** 從 IndexedDB 載入後補齊表單所需巢狀結構。 */
export function preparePartnerForForm(partner: Partner): PartnerFormValue {
  return {
    ...partner,
    individual: partner.individual ?? emptyIndividual(),
    enterprise: partner.enterprise ?? emptyEnterprise(),
    customer: { ...emptyCustomerProfile(), ...(partner.customer ?? {}) },
    supplier: { ...emptySupplierProfile(), ...(partner.supplier ?? {}) },
    addresses: (partner.addresses ?? []).map(normalizeAddress),
    additionalContacts: (partner.additionalContacts ?? []).map(normalizeContact),
    industry: partner.industry ?? '',
    tags: partner.tags ?? [],
    notes: partner.notes ?? '',
  };
}

function trimOptional(value?: string): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function trimIndividual(profile?: IndividualProfile): IndividualProfile | undefined {
  if (!profile) return undefined;
  return {
    lastName: profile.lastName.trim(),
    firstName: profile.firstName.trim(),
    phone: profile.phone.trim(),
    email: profile.email?.trim() ?? '',
    identificationNumber: profile.identificationNumber?.trim() ?? '',
    birthDate: profile.birthDate?.trim() ?? '',
  };
}

function trimEnterprise(profile?: EnterpriseProfile): EnterpriseProfile | undefined {
  if (!profile) return undefined;
  return {
    companyName: profile.companyName.trim(),
    businessID: profile.businessID?.trim() ?? '',
    taxID: profile.taxID?.trim() ?? '',
    responsiblePerson: profile.responsiblePerson?.trim() ?? '',
    phone: profile.phone?.trim() ?? '',
    email: profile.email?.trim() ?? '',
  };
}

function trimCustomer(profile?: CustomerProfile): CustomerProfile | undefined {
  if (!profile) return undefined;
  const rawDay = profile.settlementDay;
  const day =
    typeof rawDay === 'string' && rawDay !== '' ? Number(rawDay) : rawDay;
  const settlementDay =
    day != null && !Number.isNaN(Number(day)) && day >= 1 && day <= 31
      ? Math.floor(Number(day))
      : undefined;
  return {
    customerCode: trimOptional(profile.customerCode),
    categoryId: trimOptional(profile.categoryId),
    settlementDay,
    paymentTerms: trimOptional(profile.paymentTerms),
  };
}

function trimSupplier(profile?: SupplierProfile): SupplierProfile | undefined {
  if (!profile) return undefined;
  const mainProducts = (profile.mainProducts ?? []).map((s) => s.trim()).filter(Boolean);
  return {
    supplierCode: trimOptional(profile.supplierCode),
    categoryId: trimOptional(profile.categoryId),
    mainProducts: mainProducts.length ? mainProducts : undefined,
    sourceLocation: trimOptional(profile.sourceLocation),
    leadTimeNotes: trimOptional(profile.leadTimeNotes),
    deliveryTerms: trimOptional(profile.deliveryTerms),
    paymentTerms: trimOptional(profile.paymentTerms),
  };
}

function normalizeAddress(addr: PartnerAddress & { priority?: number }): PartnerAddress {
  const legacyPrimary = (addr as { priority?: number }).priority;
  return {
    id: addr.id || generateLocalId(),
    label: trimOptional(addr.label),
    city: addr.city?.trim() ?? '',
    district: trimOptional(addr.district),
    postalCode: trimOptional(addr.postalCode),
    address: addr.address?.trim() ?? '',
    country: addr.country?.trim() || '台灣',
    isPrimary: addr.isPrimary ?? legacyPrimary === 1,
  };
}

function normalizeContact(contact: AdditionalContact & { priority?: number }): AdditionalContact {
  const legacyPrimary = (contact as { priority?: number }).priority;
  return {
    id: contact.id || generateLocalId(),
    name: contact.name?.trim() ?? '',
    phone: contact.phone?.trim() ?? '',
    email: contact.email?.trim() ?? '',
    role: contact.role?.trim() ?? '',
    notes: contact.notes?.trim() ?? '',
    isPrimary: contact.isPrimary ?? legacyPrimary === 1,
  };
}

function ensureSinglePrimary<T extends { isPrimary: boolean }>(items: T[]): T[] {
  if (items.length === 0) return items;
  const primaryIndex = items.findIndex((i) => i.isPrimary);
  const idx = primaryIndex >= 0 ? primaryIndex : 0;
  return items.map((item, i) => ({ ...item, isPrimary: i === idx }));
}

export function computeDerivedFields(
  partner: Omit<Partner, 'displayName' | 'primaryPhone' | 'primaryEmail' | 'primaryCity'>
): Pick<Partner, 'displayName' | 'primaryPhone' | 'primaryEmail' | 'primaryCity'> {
  const { partnerType, individual, enterprise, addresses, additionalContacts } = partner;

  let displayName = '';
  let primaryPhone = '';
  let primaryEmail: string | undefined;

  if (partnerType === 'individual') {
    displayName = `${individual?.lastName ?? ''}${individual?.firstName ?? ''}`.trim();
    primaryPhone = individual?.phone?.trim() ?? '';
    primaryEmail = trimOptional(individual?.email);
  } else {
    displayName = enterprise?.companyName?.trim() ?? '';
    const primaryContact =
      additionalContacts?.find((c) => c.isPrimary) ?? additionalContacts?.[0];
    primaryPhone = primaryContact?.phone?.trim() || enterprise?.phone?.trim() || '';
    primaryEmail = trimOptional(primaryContact?.email) || trimOptional(enterprise?.email);
  }

  const primaryAddress =
    addresses?.find((a) => a.isPrimary) ?? addresses?.[0];
  const primaryCity = primaryAddress?.city?.trim() ?? '';

  return { displayName, primaryPhone, primaryEmail, primaryCity };
}

/** 儲存前：依角色/類型 strip 未使用區塊，並寫入衍生索引欄位。 */
export function normalizePartnerForSave(input: PartnerFormValue): Partner {
  const partnerType: PartnerType = input.partnerType;
  const isCustomer = input.isCustomer;
  const isSupplier = input.isSupplier;

  const addresses = ensureSinglePrimary((input.addresses ?? []).map(normalizeAddress));
  const additionalContacts = ensureSinglePrimary(
    (input.additionalContacts ?? []).map(normalizeContact)
  );

  const core = {
    id: input.id,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    isDeleted: input.isDeleted,
    partnerType,
    isActive: input.isActive,
    isCustomer,
    isSupplier,
    individual: partnerType === 'individual' ? trimIndividual(input.individual) : undefined,
    enterprise: partnerType === 'enterprise' ? trimEnterprise(input.enterprise) : undefined,
    customer: isCustomer ? trimCustomer(input.customer) : undefined,
    supplier: isSupplier ? trimSupplier(input.supplier) : undefined,
    addresses,
    additionalContacts,
    industry: trimOptional(input.industry),
    notes: trimOptional(input.notes),
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
  };

  const derived = computeDerivedFields(core);

  return {
    ...core,
    ...derived,
  };
}
