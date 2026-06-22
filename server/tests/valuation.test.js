const { calculateCOGSFromMovements, getWeightedAverageCostFromMovements } = require('../utils/valuation');

describe('calculateCOGSFromMovements', () => {
  const makePurchase = (qty, rate, totalAmount) => ({
    type: 'purchase', quantity: qty, rate, totalAmount: totalAmount ?? qty * rate,
  });
  const makeSale = (qty) => ({ type: 'sale', quantity: -Math.abs(qty), rate: 0, totalAmount: 0 });

  describe('FIFO', () => {
    test('simple FIFO with one purchase batch', () => {
      const movements = [makePurchase(10, 100)];
      const cogs = calculateCOGSFromMovements(movements, 5, 'fifo');
      expect(cogs).toBe(500);
    });

    test('FIFO consumes oldest batch first', () => {
      const movements = [makePurchase(10, 100), makePurchase(10, 200)];
      const cogs = calculateCOGSFromMovements(movements, 15, 'fifo');
      expect(cogs).toBe(2000);
    });

    test('FIFO with partial batch consumption', () => {
      const movements = [makePurchase(5, 100), makePurchase(5, 200)];
      const cogs = calculateCOGSFromMovements(movements, 7, 'fifo');
      expect(cogs).toBe(900);
    });

    test('FIFO with prior sale consuming some stock first', () => {
      const movements = [makePurchase(10, 100), makeSale(4), makePurchase(5, 200)];
      const cogs = calculateCOGSFromMovements(movements, 8, 'fifo');
      expect(cogs).toBe(1000);
    });

    test('FIFO exact quantity', () => {
      const movements = [makePurchase(10, 100)];
      const cogs = calculateCOGSFromMovements(movements, 10, 'fifo');
      expect(cogs).toBe(1000);
    });

    test('FIFO returns 0 when no stock available', () => {
      const movements = [makePurchase(10, 100), makeSale(10)];
      const cogs = calculateCOGSFromMovements(movements, 5, 'fifo');
      expect(cogs).toBe(0);
    });
  });

  describe('LIFO', () => {
    test('simple LIFO with one purchase batch', () => {
      const movements = [makePurchase(10, 100)];
      const cogs = calculateCOGSFromMovements(movements, 5, 'lifo');
      expect(cogs).toBe(500);
    });

    test('LIFO consumes newest batch first', () => {
      const movements = [makePurchase(10, 100), makePurchase(10, 200)];
      const cogs = calculateCOGSFromMovements(movements, 12, 'lifo');
      expect(cogs).toBe(2200);
    });

    test('LIFO with multiple batches', () => {
      const movements = [makePurchase(5, 100), makePurchase(3, 150), makePurchase(4, 200)];
      const cogs = calculateCOGSFromMovements(movements, 6, 'lifo');
      expect(cogs).toBe(1100);
    });

    test('LIFO with prior sale', () => {
      const movements = [makePurchase(10, 100), makeSale(3), makePurchase(5, 200)];
      const cogs = calculateCOGSFromMovements(movements, 7, 'lifo');
      expect(cogs).toBe(1200);
    });
  });

  describe('Weighted Average', () => {
    test('average returns same as FIFO for single batch', () => {
      const movements = [makePurchase(10, 100)];
      const cogs = calculateCOGSFromMovements(movements, 5, 'average');
      expect(cogs).toBe(500);
    });

    test('average blends costs across batches', () => {
      const movements = [makePurchase(10, 100), makePurchase(10, 200)];
      const cogs = calculateCOGSFromMovements(movements, 5, 'average');
      expect(cogs).toBe(750);
    });

    test('average with prior sale', () => {
      const movements = [makePurchase(10, 100), makeSale(4), makePurchase(5, 200)];
      const cogs = calculateCOGSFromMovements(movements, 6, 'average');
      expect(cogs).toBe(800);
    });
  });
});

describe('getWeightedAverageCostFromMovements', () => {
  test('simple average of one purchase', () => {
    const movements = [{ type: 'purchase', quantity: 10, totalAmount: 1000 }];
    expect(getWeightedAverageCostFromMovements(movements)).toBe(100);
  });

  test('average across multiple purchases', () => {
    const movements = [
      { type: 'purchase', quantity: 10, totalAmount: 1000 },
      { type: 'purchase', quantity: 20, totalAmount: 3000 },
    ];
    expect(getWeightedAverageCostFromMovements(movements)).toBe(133.33333333333334);
  });

  test('ignores sales when computing average cost', () => {
    const movements = [
      { type: 'purchase', quantity: 10, totalAmount: 1000 },
      { type: 'sale', quantity: -5, totalAmount: 0 },
      { type: 'purchase', quantity: 10, totalAmount: 3000 },
    ];
    expect(getWeightedAverageCostFromMovements(movements)).toBe(200);
  });

  test('returns 0 when no purchases', () => {
    const movements = [{ type: 'sale', quantity: -5, totalAmount: 0 }];
    expect(getWeightedAverageCostFromMovements(movements)).toBe(0);
  });

  test('returns 0 for empty array', () => {
    expect(getWeightedAverageCostFromMovements([])).toBe(0);
  });
});
