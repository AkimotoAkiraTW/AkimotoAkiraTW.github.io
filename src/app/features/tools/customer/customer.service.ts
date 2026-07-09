import { Injectable, inject } from '@angular/core';
import { LocalDatabase } from '../../../libs/local-first';
import { Partner, PartnerFormValue } from './partner.model';
import { normalizePartnerForSave } from './partner-normalize';
import { BehaviorSubject, switchMap, debounceTime, combineLatest } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private db = inject(LocalDatabase);
  private collection = this.db.collection<Partner>('partners');

  private searchSubject = new BehaviorSubject<string>('');
  private citySubject = new BehaviorSubject<string>('');
  private typeSubject = new BehaviorSubject<string>('all');
  private roleSubject = new BehaviorSubject<string>('all');
  private statusSubject = new BehaviorSubject<string>('all');

  public partnersSignal = toSignal(
    combineLatest([
      this.searchSubject,
      this.citySubject,
      this.typeSubject,
      this.roleSubject,
      this.statusSubject,
    ]).pipe(
      debounceTime(150),
      switchMap(([search, city, type, role, status]) => {
        let query = this.collection.query().where('isDeleted').equals(false);

        if (city) {
          query = query.where('primaryCity').equals(city);
        }

        query = query.filter((p) => {
          if (type !== 'all' && p.partnerType !== type) {
            return false;
          }

          if (role !== 'all') {
            if (role === 'customer' && !p.isCustomer) return false;
            if (role === 'supplier' && !p.isSupplier) return false;
            if (role === 'both' && !(p.isCustomer && p.isSupplier)) return false;
          }

          if (status === 'active' && !p.isActive) return false;
          if (status === 'inactive' && p.isActive) return false;

          if (search) {
            const kw = search.toLowerCase();
            const matchName = p.displayName?.toLowerCase().includes(kw) ?? false;
            const matchPhone = p.primaryPhone?.includes(kw) ?? false;
            const matchEmail = p.primaryEmail?.toLowerCase().includes(kw) ?? false;

            const matchId =
              p.partnerType === 'individual'
                ? (p.individual?.identificationNumber?.toLowerCase().includes(kw) ?? false)
                : (p.enterprise?.businessID?.includes(kw) ||
                    p.enterprise?.taxID?.includes(kw) ||
                    false);

            const matchProducts =
              p.supplier?.mainProducts?.some((item) => item.toLowerCase().includes(kw)) ?? false;
            const matchSource =
              p.supplier?.sourceLocation?.toLowerCase().includes(kw) ?? false;
            const matchIndustry = p.industry?.toLowerCase().includes(kw) ?? false;

            return (
              matchName ||
              matchPhone ||
              matchEmail ||
              matchId ||
              matchProducts ||
              matchSource ||
              matchIndustry
            );
          }

          return true;
        });

        return query.orderByDesc('updatedAt').asObservable();
      })
    ),
    { initialValue: [] as Partner[] }
  );

  setFilters(search: string, city: string, type: string, role: string, status: string) {
    this.searchSubject.next(search);
    this.citySubject.next(city);
    this.typeSubject.next(type);
    this.roleSubject.next(role);
    this.statusSubject.next(status);
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    return this.collection.get(id);
  }

  async savePartner(partner: PartnerFormValue) {
    const dataToSave = normalizePartnerForSave(partner);
    dataToSave.updatedAt = new Date().toISOString();

    if (partner.id) {
      await this.collection.update(partner.id, dataToSave);
    } else {
      dataToSave.createdAt = new Date().toISOString();
      await this.collection.add(dataToSave as Omit<Partner, 'id'>);
    }
  }

  async deletePartner(id: string) {
    await this.collection.delete(id);
  }
}
