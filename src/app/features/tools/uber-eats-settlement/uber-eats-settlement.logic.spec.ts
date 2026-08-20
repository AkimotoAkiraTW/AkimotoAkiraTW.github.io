import {
  allocateUnspecifiedNet,
  detectProductSettings,
  expectedBogoPayable,
  matchPayRatio,
  parseCustomizationOptions,
  parseOrderLineItem,
  resolveItemDiscount,
} from './uber-eats-settlement.logic';

describe('uber-eats-settlement.logic', () => {
  it('treats itemDiscount as the receipt strikethrough price', () => {
    expect(resolveItemDiscount(120, 96)).toEqual({
      finalPayablePrice: 96,
      explicitDiscount: 24,
    });
    expect(resolveItemDiscount(80, 10)).toEqual({
      finalPayablePrice: 10,
      explicitDiscount: 70,
    });
    expect(resolveItemDiscount(80, 0)).toEqual({
      finalPayablePrice: 80,
      explicitDiscount: 0,
    });
  });

  it('matches nanafru food subtotal and unspecified net extras', () => {
    const lines = [
      parseOrderLineItem({ title: '名間冬片', quantity: 1, price: '$45.00', subtitle: '' }, 'nanafru', 'chiu C.'),
      parseOrderLineItem(
        {
          title: '芝芝芒果波波',
          quantity: 1,
          price: '$120.00',
          subtitle: '大杯 Large size • 冰量固定 Fixed Ice Level • 0.5 分糖 5% Sugar',
          itemDiscount: { formattedAmount: '$96.00' },
        },
        'nanafru',
        '建全 林.',
      ),
      parseOrderLineItem(
        {
          title: '古早味紅茶',
          quantity: 1,
          price: '$50.00',
          subtitle: '3 分糖 30% Sugar • 微冰 Easy Ice • 布丁(限冰飲) Pudding ($10.00) • 大杯 Large size',
        },
        'nanafru',
        'Awei C.',
      ),
      parseOrderLineItem({ title: '提袋 Plastic Bag', quantity: 1, price: '$2.00', subtitle: '' }, 'nanafru', 'Awei C.'),
      parseOrderLineItem(
        {
          title: '晨曦紅茶',
          quantity: 2,
          price: '$80.00',
          subtitle: '無糖 Sugar-Free • 微冰 Easy Ice • 大杯 Large size',
        },
        'nanafru',
        'Kevin C.',
      ),
      parseOrderLineItem(
        {
          title: '翡翠綠茶鮮乳',
          quantity: 1,
          price: '$80.00',
          subtitle: '大杯 Large size ($10.00) • 無糖 Sugar-Free • 微冰 Easy Ice',
          itemDiscount: { formattedAmount: '$10.00' },
        },
        'nanafru',
        'Kevin C.',
      ),
      parseOrderLineItem(
        {
          title: '波霸娜娜紅茶鮮乳',
          quantity: 1,
          price: '$80.00',
          subtitle: '無糖 Sugar-Free • 微冰 Easy Ice • 大杯 Large size ($10.00)',
        },
        'nanafru',
        'Kevin C.',
      ),
    ];

    expect(lines.map(l => l.originalPayable)).toEqual([45, 96, 50, 2, 80, 10, 80]);
    const food = lines.reduce((sum, l) => sum + l.originalPayable, 0);
    expect(food).toBe(363);

    expect(allocateUnspecifiedNet(367, food)).toEqual({ deliveryFee: 4, globalDiscount: 0 });

    const settings = detectProductSettings(lines);
    expect(settings['芝芝芒果波波'].percentOff).toBe(0.8);
    expect(settings['芝芝芒果波波'].isBogo).toBeFalse();
    expect(settings['翡翠綠茶鮮乳'].isGift).toBeTrue();
    expect(settings['翡翠綠茶鮮乳'].percentOff).toBeNull();
  });

  it('parses drink customizations from bilingual subtitle', () => {
    expect(parseCustomizationOptions(
      '大杯 Large size • 冰量固定 Fixed Ice Level • 0.5 分糖 5% Sugar',
    )).toEqual([
      { label: '大杯', price: 0, kind: 'size' },
      { label: '冰量固定', price: 0, kind: 'ice' },
      { label: '0.5 分糖', price: 0, kind: 'sugar' },
    ]);

    expect(parseCustomizationOptions(
      '3 分糖 30% Sugar • 微冰 Easy Ice • 布丁(限冰飲) Pudding ($10.00) • 大杯 Large size',
    )).toEqual([
      { label: '3 分糖', price: 0, kind: 'sugar' },
      { label: '微冰', price: 0, kind: 'ice' },
      { label: '布丁(限冰飲)', price: 10, kind: 'topping' },
      { label: '大杯', price: 0, kind: 'size' },
    ]);

    expect(parseCustomizationOptions('無糖 Sugar-Free • 微冰 Easy Ice • 大杯 Large size ($10.00)')).toEqual([
      { label: '無糖', price: 0, kind: 'sugar' },
      { label: '微冰', price: 0, kind: 'ice' },
      { label: '大杯', price: 10, kind: 'size' },
    ]);

    expect(parseCustomizationOptions('')).toEqual([]);
    expect(parseOrderLineItem(
      { title: '晨曦紅茶', quantity: 2, price: '$80.00', subtitle: '無糖 Sugar-Free • 微冰 Easy Ice' },
      'nanafru',
      'Kevin C.',
    ).customizations.map((c) => c.label)).toEqual(['無糖', '微冰']);
  });

  it('detects medium-cup BOGO as unit base plus all upgrades', () => {
    expect(expectedBogoPayable(45, 2, 20)).toBe(65);
    expect(matchPayRatio(96, 120)).toBe(0.8);
  });
});
