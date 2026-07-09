import { QueryBuilder } from './query-builder';
import { BaseEntity } from '../interfaces/base-entity';

export interface WhereOperation<T> {
  field: string;
  operator: 'equals' | 'notEquals' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'startsWith' | 'contains' | 'anyOf' | 'isNull' | 'isNotNull';
  value: any;
  upperValue?: any;
}

export class WhereClause<T extends BaseEntity, V> {
  constructor(private builder: QueryBuilder<T>, private field: string) {}

  private addOp(operator: WhereOperation<T>['operator'], value: any, upperValue?: any): QueryBuilder<T> {
    return this.builder.addWhereOperation({
      field: this.field,
      operator,
      value,
      upperValue
    });
  }

  equals(value: V): QueryBuilder<T> { return this.addOp('equals', value); }
  notEquals(value: V): QueryBuilder<T> { return this.addOp('notEquals', value); }
  gt(value: V): QueryBuilder<T> { return this.addOp('gt', value); }
  gte(value: V): QueryBuilder<T> { return this.addOp('gte', value); }
  lt(value: V): QueryBuilder<T> { return this.addOp('lt', value); }
  lte(value: V): QueryBuilder<T> { return this.addOp('lte', value); }
  between(lower: V, upper: V): QueryBuilder<T> { return this.addOp('between', lower, upper); }
  startsWith(prefix: string): QueryBuilder<T> { return this.addOp('startsWith', prefix); }
  contains(substring: string): QueryBuilder<T> { return this.addOp('contains', substring); }
  anyOf(values: V[]): QueryBuilder<T> { return this.addOp('anyOf', values); }
  isNull(): QueryBuilder<T> { return this.addOp('isNull', null); }
  isNotNull(): QueryBuilder<T> { return this.addOp('isNotNull', null); }
}
