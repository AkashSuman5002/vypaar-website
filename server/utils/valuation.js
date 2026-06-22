const calculateCOGSFromMovements = (movements, quantitySold, method = 'average') => {
  if (method === 'average') {
    const purchases = movements.filter((m) => m.type === 'purchase');
    const totalQty = purchases.reduce((s, p) => s + p.quantity, 0);
    const totalCost = purchases.reduce((s, p) => s + (p.totalAmount || p.quantity * p.rate), 0);
    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
    return Math.min(quantitySold, totalQty) * avgCost;
  }

  let available = [];
  let remainingQty = quantitySold;
  let totalCOGS = 0;

  movements.forEach((m) => {
    if (m.type === 'purchase') {
      available.push({ qty: m.quantity, rate: m.rate || m.totalAmount / m.quantity });
    } else if (m.type === 'sale') {
      let qtyToRemove = Math.abs(m.quantity);
      while (qtyToRemove > 0 && available.length > 0) {
        const batch = method === 'lifo' ? available[available.length - 1] : available[0];
        const consumed = Math.min(qtyToRemove, batch.qty);
        batch.qty -= consumed;
        qtyToRemove -= consumed;
        if (batch.qty <= 0) {
          if (method === 'lifo') available.pop();
          else available.shift();
        }
      }
    }
  });

  const consumeBatches = method === 'lifo' ? [...available].reverse() : available;
  for (const batch of consumeBatches) {
    if (remainingQty <= 0) break;
    const consumed = Math.min(remainingQty, batch.qty);
    totalCOGS += consumed * batch.rate;
    remainingQty -= consumed;
  }

  return totalCOGS;
};

const getWeightedAverageCostFromMovements = (movements) => {
  const purchases = movements.filter((m) => m.type === 'purchase');
  const totalQty = purchases.reduce((s, p) => s + p.quantity, 0);
  const totalCost = purchases.reduce((s, p) => s + (p.totalAmount || p.quantity * p.rate), 0);
  return totalQty > 0 ? totalCost / totalQty : 0;
};

module.exports = { calculateCOGSFromMovements, getWeightedAverageCostFromMovements };
